import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, MessageSquare, ShieldCheck, Smartphone, Laptop, Tv, Car, Home, Sofa, Shirt, Package } from "lucide-react";

const ICONS: Record<string, any> = { Smartphone, Laptop, Tv, Car, Home, Sofa, Shirt, Package };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SuqLink — Buy & sell, locally" },
      { name: "description", content: "A multilingual marketplace where buyers find what they need and sellers reach the right people." },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useI18n();

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const { data: trending } = useQuery({
    queryKey: ["trending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, currency, location, condition, listing_images(url)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const catName = (c: any) => (lang === "am" ? c.name_am : lang === "or" ? c.name_or : lang === "so" ? c.name_so : c.name_en) || c.name_en;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl animate-float" />
        <div className="pointer-events-none absolute top-40 -right-20 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-float-2" />

        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 lg:pt-28 lg:pb-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-glow" />
                Multilingual · EN · አማርኛ · Afaan Oromoo · Soomaali
              </div>
              <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                {t("tagline").split(" — ")[0]}
                <br />
                <span className="text-gradient">{t("tagline").split(" — ")[1] ?? ""}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Browse local listings, filter by exactly what you need, and message sellers directly through the app or Telegram, Instagram, or phone.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/browse">
                  <Button size="lg" className="btn-hero gap-2 text-base font-medium">
                    {t("hero_cta_browse")} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="border-border bg-surface/60 text-base hover:bg-surface-2">
                    {t("hero_cta_sell")}
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* 3D floating cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block h-[500px]"
              style={{ perspective: "1200px" }}
            >
              <FloatingCard delay={0} className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-6deg]" tilt="rotateY(-12deg) rotateX(8deg)">
                <div className="text-xs text-muted-foreground">Phone · Used</div>
                <div className="mt-1 font-display text-xl">Samsung S22 Ultra</div>
                <div className="mt-3 text-2xl font-bold text-gradient">45,000 ETB</div>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">256 GB</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">Burgundy</span>
                </div>
              </FloatingCard>
              <FloatingCard delay={0.4} className="left-4 top-12 rotate-[-12deg]" tilt="rotateY(14deg) rotateX(6deg)">
                <div className="text-xs text-muted-foreground">House · 3BR</div>
                <div className="mt-1 font-display text-xl">Bole · Modern Apt</div>
                <div className="mt-3 text-2xl font-bold text-gradient">9.2M ETB</div>
              </FloatingCard>
              <FloatingCard delay={0.8} className="right-4 bottom-8 rotate-[10deg]" tilt="rotateY(-14deg) rotateX(-6deg)">
                <div className="text-xs text-muted-foreground">Laptop · New</div>
                <div className="mt-1 font-display text-xl">MacBook Pro M3</div>
                <div className="mt-3 text-2xl font-bold text-gradient">$2,400</div>
              </FloatingCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">{t("categories")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Pick a category to start browsing.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {(cats ?? []).map((c, i) => {
            const Icon = ICONS[c.icon ?? "Package"] ?? Package;
            return (
              <motion.div key={c.id}
                initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              >
                <Link to="/browse" search={{ category: c.slug } as any}
                  className="group block rounded-xl glow-card p-4 text-center transition hover:border-primary/50 hover:shadow-glow">
                  <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 transition group-hover:scale-110">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="text-sm font-medium">{catName(c)}</div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Trending */}
      {trending && trending.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">{t("trending")}</h2>
            <Link to="/browse" className="text-sm text-accent hover:underline">{t("view_all")} →</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trending.map((l: any) => (
              <Link key={l.id} to="/listings/$id" params={{ id: l.id }}
                className="group rounded-xl glow-card overflow-hidden transition hover:border-primary/50 hover:-translate-y-1">
                <div className="aspect-[4/3] bg-surface-2 overflow-hidden">
                  {l.listing_images?.[0]?.url ? (
                    <SignedImg path={l.listing_images[0].url} alt={l.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground"><Package className="h-10 w-10 opacity-40" /></div>
                  )}
                </div>
                <div className="p-4">
                  <div className="line-clamp-1 font-medium">{l.title}</div>
                  <div className="mt-1 text-lg font-bold text-gradient">{Number(l.price).toLocaleString()} {l.currency}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{l.location ?? "—"}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-center font-display text-3xl font-semibold sm:text-4xl">{t("how_it_works")}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { icon: Search, k: "step_browse", d: "step_browse_desc" },
            { icon: MessageSquare, k: "step_contact", d: "step_contact_desc" },
            { icon: ShieldCheck, k: "step_done", d: "step_done_desc" },
          ].map(({ icon: Icon, k, d }, i) => (
            <motion.div key={k}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glow-card rounded-2xl p-6"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-glow">
                <Icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="mt-4 font-display text-xl">{t(k as any)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(d as any)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function FloatingCard({ children, className, delay, tilt }: { children: React.ReactNode; className?: string; delay: number; tilt: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className={`absolute w-64 rounded-2xl glow-card p-5 shadow-glow ${className ?? ""}`}
      style={{ transform: tilt, transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}

export function publicUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
  return `${base}/storage/v1/object/public/listing-images/${path}`;
}
