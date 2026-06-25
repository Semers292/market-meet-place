import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

type AdminSession = { unlocked?: boolean; at?: number };

const sessionConfig = () => ({
  password: process.env.SESSION_SECRET!,
  name: "suqlink-admin",
  maxAge: 60 * 60 * 8, // 8 hours
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
});

function passwordMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function requireAdminUnlocked() {
  const s = await useSession<AdminSession>(sessionConfig());
  if (!s.data.unlocked) throw new Error("Admin locked");
}

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const s = await useSession<AdminSession>(sessionConfig());
  return { unlocked: !!s.data.unlocked };
});

export const adminUnlock = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("ADMIN_PASSWORD not configured");
    // small delay to throttle brute force
    await new Promise((r) => setTimeout(r, 400));
    if (!passwordMatches(data.password, expected)) return { ok: false as const };
    const s = await useSession<AdminSession>(sessionConfig());
    await s.update({ unlocked: true, at: Date.now() });
    return { ok: true as const };
  });

export const adminLock = createServerFn({ method: "POST" }).handler(async () => {
  const s = await useSession<AdminSession>(sessionConfig());
  await s.clear();
  return { ok: true as const };
});

// === Admin data ops, gated by session ===

export const adminListPendingSellers = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("seller_verifications")
    .select("seller_id, id_front_url, id_back_url, status, created_at, rejection_reason, profiles!seller_verifications_seller_id_fkey(phone, full_name)")
    .order("created_at", { ascending: false });

  const enriched = await Promise.all((rows ?? []).map(async (r: any) => {
    const sign = async (path: string) => {
      const { data } = await supabaseAdmin.storage.from("seller-ids").createSignedUrl(path, 60 * 30);
      return data?.signedUrl ?? null;
    };
    return {
      ...r,
      id_front_signed: r.id_front_url ? await sign(r.id_front_url) : null,
      id_back_signed: r.id_back_url ? await sign(r.id_back_url) : null,
    };
  }));
  return { rows: enriched };
});

export const adminReviewSeller = createServerFn({ method: "POST" })
  .inputValidator((d: { sellerId: string; action: "approve" | "reject"; reason?: string }) =>
    z.object({
      sellerId: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      reason: z.string().max(500).optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("seller_verifications").update({
      status: data.action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      rejection_reason: data.action === "reject" ? data.reason ?? null : null,
    }).eq("seller_id", data.sellerId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      action: `seller_${data.action}`,
      target: data.sellerId,
      metadata: data.reason ? { reason: data.reason } : null,
    });

    const { data: profile } = await supabaseAdmin.from("profiles").select("phone").eq("id", data.sellerId).maybeSingle();
    if (profile?.phone) {
      const apiKey = process.env.TEXTBEE_API_KEY, deviceId = process.env.TEXTBEE_DEVICE_ID;
      if (apiKey && deviceId) {
        const msg = data.action === "approve"
          ? "Your SuqLink seller account is approved! You can now post listings."
          : `Your SuqLink seller application was rejected. ${data.reason ?? ""}`.trim();
        try {
          await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({ recipients: [profile.phone], message: msg }),
          });
        } catch (e) { console.error("[sms] notify seller approval failed", e); }
      }
    }
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).limit(500);
  return { rows: data ?? [] };
});

export const adminListListings = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("listings")
    .select("id, title, price, currency, status, created_at, profiles!listings_seller_id_fkey(phone)")
    .order("created_at", { ascending: false }).limit(500);
  return { rows: data ?? [] };
});
