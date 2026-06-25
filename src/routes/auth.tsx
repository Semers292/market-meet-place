import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { requestSmsCode, signupBuyer, signupSeller, resolveSigninEmail } from "@/lib/auth.functions";
import { ShoppingBag, Store, Loader2, Upload } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in or create an account · SuqLink" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_60%)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[600px] rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-md px-4 py-16 sm:px-6">
          <h1 className="text-center font-display text-4xl font-semibold">{t("nav_signin")} · {t("nav_signup")}</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">{t("tagline")}</p>

          <div className="mt-8 glow-card rounded-2xl p-6">
            <Tabs defaultValue="buyer">
              <TabsList className="grid w-full grid-cols-2 bg-surface-2">
                <TabsTrigger value="buyer" className="gap-2"><ShoppingBag className="h-4 w-4" />{t("role_buyer")}</TabsTrigger>
                <TabsTrigger value="seller" className="gap-2"><Store className="h-4 w-4" />{t("role_seller")}</TabsTrigger>
              </TabsList>
              <TabsContent value="buyer" className="mt-6"><RoleForms role="buyer" /></TabsContent>
              <TabsContent value="seller" className="mt-6"><RoleForms role="seller" /></TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function RoleForms({ role }: { role: "buyer" | "seller" }) {
  const { t } = useI18n();
  return (
    <Tabs defaultValue="signin">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">{t("signin")}</TabsTrigger>
        <TabsTrigger value="signup">{t("signup")}</TabsTrigger>
      </TabsList>
      <TabsContent value="signin" className="mt-5"><SignIn /></TabsContent>
      <TabsContent value="signup" className="mt-5">
        {role === "buyer" ? <BuyerSignup /> : <SellerSignup />}
      </TabsContent>
    </Tabs>
  );
}

function SignIn() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const resolve = useServerFn(resolveSigninEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { email } = await resolve({ data: { phone } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refresh();
      toast.success(t("signin_success"));
      nav({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? t("error_generic"));
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("phone")} value={phone} onChange={setPhone} placeholder="+251 9..." type="tel" />
      <Field label={t("password")} value={password} onChange={setPassword} type="password" />
      <Button type="submit" disabled={loading} className="w-full btn-hero">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("signin")}
      </Button>
    </form>
  );
}

function BuyerSignup() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const requestCode = useServerFn(requestSmsCode);
  const signup = useServerFn(signupBuyer);

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setLoading(true);
    try {
      const r = await requestCode({ data: { phone, purpose: "signup_buyer" } });
      toast.success(t("code_sent", { phone: r.phone }));
      setStep(2);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error(t("password_too_short"));
    if (password !== confirm) return toast.error(t("password_mismatch"));
    setLoading(true);
    try {
      const { email } = await signup({ data: { phone, code, password, fullName: fullName || undefined } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refresh();
      toast.success(t("signup_success"));
      nav({ to: "/" });
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <AnimatePresence mode="wait">
      {step === 1 ? (
        <motion.form key="s1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
          onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-4">
          <Field label={t("phone")} value={phone} onChange={setPhone} placeholder="+251 9..." type="tel" />
          <Button type="submit" disabled={loading || !phone} className="w-full btn-hero">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("send_code")}
          </Button>
        </motion.form>
      ) : (
        <motion.form key="s2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
          onSubmit={finish} className="space-y-4">
          <Field label={t("sms_code")} value={code} onChange={setCode} placeholder="6-digit code" />
          <Field label={t("full_name")} value={fullName} onChange={setFullName} />
          <Field label={t("password")} value={password} onChange={setPassword} type="password" />
          <Field label={t("confirm_password")} value={confirm} onChange={setConfirm} type="password" />
          <Button type="submit" disabled={loading} className="w-full btn-hero">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("signup")}
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

function SellerSignup() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const requestCode = useServerFn(requestSmsCode);
  const signup = useServerFn(signupSeller);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setLoading(true);
    try {
      const r = await requestCode({ data: { phone, purpose: "signup_seller" } });
      toast.success(t("code_sent", { phone: r.phone }));
      setStep(2);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error(t("password_too_short"));
    if (password !== confirm) return toast.error(t("password_mismatch"));
    if (!front || !back) return toast.error("Upload both ID photos");
    setLoading(true);
    try {
      // 1) Sign up via Supabase first using a temp email so we can authenticate
      //    -- but we can't upload before the user exists. Strategy: do signup,
      //    then sign in, then upload, then save verification. Use server fn that
      //    accepts already-uploaded paths. So we upload as the new authenticated user.
      //
      // Two-step server flow: create account (no verification yet), sign in, upload, then call a
      // submitVerification fn. For simplicity here we sign up first, sign in, upload, then submit.

      // Use a temp helper: bypass server signupSeller verification check by doing the steps inline.
      // We'll piggyback on signupBuyer flow won't work — we need 'seller' role. So we call signupSeller
      // with a tentative empty path, then re-upload and update. Instead, simpler: create account locally:
      // — actually our signupSeller expects paths. We need uploads BEFORE the user exists, but storage
      // policy requires auth. Workaround: upload to a temp path under a random uuid using service via
      // a dedicated server fn. Easier path: do the signup with a tiny dummy path then upload & update.

      // Cleanest path: upload via a server function that accepts base64 and uses service role.
      const frontB64 = await fileToBase64(front);
      const backB64 = await fileToBase64(back);

      const { uploadSellerIds } = await import("@/lib/uploads.functions");
      const { idFrontPath, idBackPath } = await uploadSellerIds({
        data: { phone, frontBase64: frontB64, frontType: front.type, backBase64: backB64, backType: back.type },
      });

      const { email } = await signup({
        data: { phone, code, password, fullName: fullName || undefined, idFrontPath, idBackPath },
      });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refresh();
      toast.success(t("signup_success"));
      nav({ to: "/seller/dashboard" });
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <AnimatePresence mode="wait">
      {step === 1 && (
        <motion.form key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-4">
          <Field label={t("phone")} value={phone} onChange={setPhone} placeholder="+251 9..." type="tel" />
          <Button type="submit" disabled={loading || !phone} className="w-full btn-hero">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("send_code")}
          </Button>
        </motion.form>
      )}
      {step === 2 && (
        <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
          <Field label={t("sms_code")} value={code} onChange={setCode} />
          <Field label={t("full_name")} value={fullName} onChange={setFullName} />
          <Field label={t("password")} value={password} onChange={setPassword} type="password" />
          <Field label={t("confirm_password")} value={confirm} onChange={setConfirm} type="password" />
          <Button type="button" onClick={() => setStep(3)} disabled={!code || !password || password !== confirm} className="w-full btn-hero">
            Next: upload ID
          </Button>
        </motion.div>
      )}
      {step === 3 && (
        <motion.form key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={finish} className="space-y-4">
          <FileField label={t("id_front")} file={front} onChange={setFront} />
          <FileField label={t("id_back")} file={back} onChange={setBack} />
          <p className="text-xs text-muted-foreground">Your ID is private — only admins can see it for verification.</p>
          <Button type="submit" disabled={loading || !front || !back} className="w-full btn-hero">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("submit")}
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
        className="bg-surface-2 border-border focus:border-primary" />
    </div>
  );
}

function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 p-4 text-sm hover:border-primary">
        <Upload className="h-4 w-4 text-accent" />
        <span className="flex-1 text-muted-foreground">{file ? file.name : "Choose image…"}</span>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
