import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Buyer clicks "Buy Now" → notify admin (broker) with listing + buyer info.
export const requestBuyNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { listingId: string; note?: string }) =>
    z.object({ listingId: z.string().uuid(), note: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: listing, error } = await supabase
      .from("listings").select("id, title, price, currency, seller_id").eq("id", data.listingId).single();
    if (error || !listing) throw new Error("Listing not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: buyer } = await supabaseAdmin
      .from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();

    // Log for admin dashboard
    await supabaseAdmin.from("admin_logs").insert({
      action: "buy_now_request",
      target: listing.id,
      metadata: {
        buyer_id: userId,
        buyer_name: buyer?.full_name ?? null,
        buyer_phone: buyer?.phone ?? null,
        listing_title: listing.title,
        listing_price: listing.price,
        listing_currency: listing.currency,
        note: data.note ?? null,
        at: new Date().toISOString(),
      },
    });

    // Best-effort SMS to admin if ADMIN_PHONE secret is configured
    const adminPhone = process.env.ADMIN_PHONE;
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    if (adminPhone && apiKey && deviceId) {
      try {
        await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({
            recipients: [adminPhone],
            message: `SuqLink BUY NOW: ${buyer?.full_name ?? "Buyer"} (${buyer?.phone ?? "?"}) wants "${listing.title}" – ${listing.price} ${listing.currency}.`,
          }),
        });
      } catch (e) { console.error("[sms] admin buy-now failed", e); }
    }

    return { ok: true };
  });
