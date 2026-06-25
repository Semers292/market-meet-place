import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    categoryId: string;
    title: string;
    description: string;
    price: number;
    currency?: string;
    condition?: "new" | "used" | null;
    location?: string;
    imagePaths: string[];
    attributes: { key: string; value: string }[];
    contacts: { type: "phone" | "telegram" | "instagram" | "whatsapp" | "in_app"; value: string }[];
  }) => z.object({
    categoryId: z.string().uuid(),
    title: z.string().min(3).max(120),
    description: z.string().min(5).max(4000),
    price: z.number().nonnegative(),
    currency: z.string().min(1).max(8).optional(),
    condition: z.enum(["new", "used"]).nullable().optional(),
    location: z.string().max(120).optional(),
    imagePaths: z.array(z.string()).max(10),
    attributes: z.array(z.object({ key: z.string().min(1).max(40), value: z.string().min(1).max(200) })).max(20),
    contacts: z.array(z.object({
      type: z.enum(["phone", "telegram", "instagram", "whatsapp", "in_app"]),
      value: z.string().min(1).max(200),
    })).min(1).max(5),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify seller approved
    const { data: v } = await supabase.from("seller_verifications")
      .select("status").eq("seller_id", userId).maybeSingle();
    if (!v || v.status !== "approved") throw new Error("Seller account not approved yet");

    const { data: listing, error } = await supabase.from("listings").insert({
      seller_id: userId,
      category_id: data.categoryId,
      title: data.title,
      description: data.description,
      price: data.price,
      currency: data.currency ?? "ETB",
      condition: data.condition ?? null,
      location: data.location ?? null,
      status: "pending",
    }).select("id").single();
    if (error || !listing) throw new Error(error?.message ?? "Failed to create listing");

    if (data.imagePaths.length) {
      await supabase.from("listing_images").insert(
        data.imagePaths.map((url, i) => ({ listing_id: listing.id, url, sort_order: i })),
      );
    }
    if (data.attributes.length) {
      await supabase.from("listing_attributes").insert(
        data.attributes.map((a) => ({ listing_id: listing.id, key: a.key, value: a.value })),
      );
    }
    await supabase.from("contact_options").insert(
      data.contacts.map((c) => ({ listing_id: listing.id, type: c.type, value: c.value })),
    );

    return { ok: true, id: listing.id };
  });

// Admin: approve / reject seller
export const reviewSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sellerId: string; action: "approve" | "reject"; reason?: string }) =>
    z.object({
      sellerId: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      reason: z.string().max(500).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { error } = await supabase.from("seller_verifications").update({
      status: data.action === "approve" ? "approved" : "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: data.action === "reject" ? data.reason ?? null : null,
    }).eq("seller_id", data.sellerId);
    if (error) throw new Error(error.message);

    await supabase.from("admin_logs").insert({
      admin_id: userId,
      action: `seller_${data.action}`,
      target: data.sellerId,
      metadata: data.reason ? { reason: data.reason } : null,
    });

    // Notify by SMS
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

// Admin: list pending sellers with signed URLs for the ID images
export const listPendingSellers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

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
        id_front_signed: await sign(r.id_front_url),
        id_back_signed: await sign(r.id_back_url),
      };
    }));
    return { rows: enriched };
  });

// Admin: promote a user to admin (used for initial bootstrap by an existing admin)
export const adminPromote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    return { ok: true };
  });

// One-time bootstrap: the very first signed-in user can claim admin if no admin exists yet.
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An admin already exists");
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    return { ok: true };
  });
