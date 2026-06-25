import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone } from "./phone";

// Upload seller ID images using service role (user not yet created).
// Files are scoped under a phone-derived prefix so they can be re-claimed.
export const uploadSellerIds = createServerFn({ method: "POST" })
  .inputValidator((d: {
    phone: string;
    frontBase64: string; frontType: string;
    backBase64: string; backType: string;
  }) => z.object({
    phone: z.string(),
    frontBase64: z.string().min(10),
    frontType: z.string().min(3),
    backBase64: z.string().min(10),
    backType: z.string().min(3),
  }).parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Invalid phone");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const folder = `pending/${phone.replace(/[^\d]/g, "")}`;
    const ext = (t: string) => (t.includes("png") ? "png" : t.includes("webp") ? "webp" : "jpg");
    const frontPath = `${folder}/front-${Date.now()}.${ext(data.frontType)}`;
    const backPath = `${folder}/back-${Date.now()}.${ext(data.backType)}`;

    const frontBuf = Buffer.from(data.frontBase64, "base64");
    const backBuf = Buffer.from(data.backBase64, "base64");

    const up1 = await supabaseAdmin.storage.from("seller-ids").upload(frontPath, frontBuf, {
      contentType: data.frontType, upsert: true,
    });
    if (up1.error) throw new Error(up1.error.message);
    const up2 = await supabaseAdmin.storage.from("seller-ids").upload(backPath, backBuf, {
      contentType: data.backType, upsert: true,
    });
    if (up2.error) throw new Error(up2.error.message);

    return { idFrontPath: frontPath, idBackPath: backPath };
  });

// Upload listing images for an authenticated seller.
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const uploadListingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { base64: string; contentType: string }) =>
    z.object({ base64: z.string().min(10), contentType: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ext = data.contentType.includes("png") ? "png" : data.contentType.includes("webp") ? "webp" : "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const buf = Buffer.from(data.base64, "base64");
    const { error } = await supabaseAdmin.storage.from("listing-images").upload(path, buf, {
      contentType: data.contentType, upsert: false,
    });
    if (error) throw new Error(error.message);
    return { path };
  });
