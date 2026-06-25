import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone, phoneToInternalEmail } from "./phone";

const TEXTBEE_URL = "https://api.textbee.dev/api/v1/gateway/devices";

async function sendSms(phone: string, message: string) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;
  if (!apiKey || !deviceId) {
    console.error("[sms] TextBee credentials missing");
    throw new Error("SMS service not configured");
  }
  const res = await fetch(`${TEXTBEE_URL}/${deviceId}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ recipients: [phone], message }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[sms] textbee error", res.status, text);
    throw new Error("Failed to send SMS");
  }
}

async function hashCode(code: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(code, 8);
}
async function compareCode(code: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(code, hash);
}

export const requestSmsCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; purpose: "signup_buyer" | "signup_seller" | "reset" }) =>
    z.object({
      phone: z.string().min(4),
      purpose: z.enum(["signup_buyer", "signup_seller", "reset"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Invalid phone number");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // For signups, ensure phone not already taken
    if (data.purpose !== "reset") {
      const { data: existing } = await supabaseAdmin
        .from("profiles").select("id").eq("phone", phone).maybeSingle();
      if (existing) throw new Error("Phone number already registered");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await hashCode(code);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("sms_codes").insert({
      phone, code_hash, purpose: data.purpose, expires_at,
    });
    if (error) throw new Error(error.message);

    await sendSms(phone, `Your SuqLink verification code is ${code}. Expires in 10 minutes.`);
    return { ok: true, phone };
  });

async function verifyCode(phone: string, code: string, purpose: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sms_codes")
    .select("*")
    .eq("phone", phone).eq("purpose", purpose).eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return false;
  const ok = await compareCode(code, data.code_hash);
  if (!ok) {
    await supabaseAdmin.from("sms_codes").update({ attempts: data.attempts + 1 }).eq("id", data.id);
    return false;
  }
  await supabaseAdmin.from("sms_codes").update({ consumed: true }).eq("id", data.id);
  return true;
}

export const signupBuyer = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string; password: string; fullName?: string }) =>
    z.object({
      phone: z.string(),
      code: z.string().length(6),
      password: z.string().min(6),
      fullName: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Invalid phone number");
    const ok = await verifyCode(phone, data.code, "signup_buyer");
    if (!ok) throw new Error("Invalid or expired code");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = phoneToInternalEmail(phone);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email, password: data.password, email_confirm: true,
      user_metadata: { phone, role: "buyer", full_name: data.fullName ?? null },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Signup failed");

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id, phone, full_name: data.fullName ?? null,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "buyer" });

    return { ok: true, email };
  });

export const signupSeller = createServerFn({ method: "POST" })
  .inputValidator((d: {
    phone: string; code: string; password: string; fullName?: string;
    idFrontPath: string; idBackPath: string;
  }) => z.object({
    phone: z.string(),
    code: z.string().length(6),
    password: z.string().min(6),
    fullName: z.string().optional(),
    idFrontPath: z.string().min(1),
    idBackPath: z.string().min(1),
  }).parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Invalid phone number");
    const ok = await verifyCode(phone, data.code, "signup_seller");
    if (!ok) throw new Error("Invalid or expired code");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = phoneToInternalEmail(phone);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email, password: data.password, email_confirm: true,
      user_metadata: { phone, role: "seller", full_name: data.fullName ?? null },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Signup failed");

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id, phone, full_name: data.fullName ?? null,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "seller" });
    await supabaseAdmin.from("seller_verifications").insert({
      seller_id: created.user.id,
      id_front_url: data.idFrontPath,
      id_back_url: data.idBackPath,
      status: "pending",
    });

    return { ok: true, email };
  });

export const resolveSigninEmail = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => z.object({ phone: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Invalid phone number");
    return { email: phoneToInternalEmail(phone) };
  });
