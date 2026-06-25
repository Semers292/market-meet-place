import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Notify a seller by SMS when a buyer contacts them.
export const notifySellerInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { listingId: string; message: string }) =>
    z.object({ listingId: z.string().uuid(), message: z.string().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: listing, error } = await supabase
      .from("listings").select("id, seller_id, title").eq("id", data.listingId).single();
    if (error || !listing) throw new Error("Listing not found");

    // Persist in-app message
    const { error: msgErr } = await supabase.from("messages").insert({
      listing_id: listing.id, sender_id: userId, recipient_id: listing.seller_id, body: data.message,
    });
    if (msgErr) throw new Error(msgErr.message);

    // Fire-and-forget SMS to seller
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sellerProfile } = await supabaseAdmin
      .from("profiles").select("phone").eq("id", listing.seller_id).maybeSingle();
    if (sellerProfile?.phone) {
      const apiKey = process.env.TEXTBEE_API_KEY;
      const deviceId = process.env.TEXTBEE_DEVICE_ID;
      if (apiKey && deviceId) {
        try {
          await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({
              recipients: [sellerProfile.phone],
              message: `New inquiry on "${listing.title}" via SuqLink. Sign in to reply.`,
            }),
          });
        } catch (e) { console.error("[sms] notify seller failed", e); }
      }
    }
    return { ok: true };
  });
