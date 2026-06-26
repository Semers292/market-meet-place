import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

type AdminSession = { unlocked?: boolean; at?: number };

const sessionConfig = () => ({
  password: process.env.SESSION_SECRET!,
  name: "suqlink-admin",
  maxAge: 60 * 60 * 8, // 8 hours
  // sameSite=none + secure lets the cookie persist when the app is loaded
  // inside the Lovable preview iframe and in mobile in-app browsers.
  cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
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
  const { data: verifications, error } = await supabaseAdmin
    .from("seller_verifications")
    .select("seller_id, id_front_url, id_back_url, status, created_at, rejection_reason")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const sellerIds = (verifications ?? []).map((row) => row.seller_id);
  const { data: profiles, error: profilesError } = sellerIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, phone, full_name")
        .in("id", sellerIds)
    : { data: [], error: null };
  if (profilesError) throw new Error(profilesError.message);

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const enriched = await Promise.all((verifications ?? []).map(async (r: any) => {
    const sign = async (path: string) => {
      const { data } = await supabaseAdmin.storage.from("seller-ids").createSignedUrl(path, 60 * 30);
      return data?.signedUrl ?? null;
    };
    return {
      ...r,
      profiles: profilesById.get(r.seller_id) ?? null,
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
      admin_id: null,
      action: `seller_${data.action}`,
      target: data.sellerId,
      metadata: data.reason ? { reason: data.reason } : null,
    });

    const { data: profile } = await supabaseAdmin.from("profiles").select("phone").eq("id", data.sellerId).maybeSingle();
    if (profile?.phone) {
      const apiKey = process.env.TEXTBEE_API_KEY, deviceId = process.env.TEXTBEE_DEVICE_ID;
      if (apiKey && deviceId) {
        const msg = data.action === "approve"
          ? "SuqLink: Your seller account is APPROVED ✅. Next steps: 1) Sign in 2) Open Seller Dashboard 3) Tap 'New listing' to post your first item. Each listing is reviewed by admin before going live."
          : `SuqLink: Your seller application was REJECTED ❌. Reason: ${data.reason ?? "Not specified"}. Next steps: 1) Fix the issue (clearer ID photos, matching name/phone) 2) Sign up again with valid documents. Questions? Reply to this number.`.trim();
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
  const { data: listings, error } = await supabaseAdmin
    .from("listings")
    .select("id, title, description, price, currency, status, seller_id, created_at, rejection_reason, listing_images(url)")
    .order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);

  const sellerIds = Array.from(new Set((listings ?? []).map((l) => l.seller_id).filter(Boolean)));
  const { data: profiles } = sellerIds.length
    ? await supabaseAdmin.from("profiles").select("id, phone, full_name").in("id", sellerIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Sign listing image URLs (bucket is private)
  const signImg = async (path: string) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const { data } = await supabaseAdmin.storage.from("listing-images").createSignedUrl(path, 60 * 30);
    return data?.signedUrl ?? null;
  };

  const rows = await Promise.all((listings ?? []).map(async (l: any) => ({
    ...l,
    profiles: profilesById.get(l.seller_id) ?? null,
    listing_images: await Promise.all((l.listing_images ?? []).map(async (img: any) => ({ url: await signImg(img.url) }))),
  })));

  return { rows };
});

export const adminReviewListing = createServerFn({ method: "POST" })
  .inputValidator((d: { listingId: string; action: "approve" | "reject"; reason?: string }) =>
    z.object({
      listingId: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      reason: z.string().max(500).optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const newStatus = data.action === "approve" ? "active" : "rejected";
    const { data: updated, error } = await supabaseAdmin.from("listings").update({
      status: newStatus,
      rejection_reason: data.action === "reject" ? data.reason ?? null : null,
    }).eq("id", data.listingId).select("seller_id, title").maybeSingle();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: null,
      action: `listing_${data.action}`,
      target: data.listingId,
      metadata: data.reason ? { reason: data.reason } : null,
    });

    if (updated?.seller_id) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("phone").eq("id", updated.seller_id).maybeSingle();
      if (profile?.phone) {
        const apiKey = process.env.TEXTBEE_API_KEY, deviceId = process.env.TEXTBEE_DEVICE_ID;
        if (apiKey && deviceId) {
          const msg = data.action === "approve"
            ? `Your SuqLink listing "${updated.title}" is approved and now live.`
            : `Your SuqLink listing "${updated.title}" was rejected. ${data.reason ?? ""}`.trim();
          try {
            await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": apiKey },
              body: JSON.stringify({ recipients: [profile.phone], message: msg }),
            });
          } catch (e) { console.error("[sms] notify listing review failed", e); }
        }
      }
    }
    return { ok: true };
  });

