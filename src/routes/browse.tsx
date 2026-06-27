import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { publicUrl } from "./index";
import { SignedImg } from "@/components/SignedImg";
import { Package, MapPin } from "lucide-react";
import { BuyNowButton } from "@/components/BuyNowButton";

const searchSchema = z.object({
  category: fallback(z.string(), "").default(""),
  condition: fallback(z.enum(["any", "new", "used"]), "any").default("any"),
  q: fallback(z.string(), "").default(""),
  min: fallback(z.number(), 0).default(0),
  max: fallback(z.number(), 0).default(0),
  sort: fallback(z.enum(["newest", "cheap", "pricy"]), "newest").default("newest"),
});

export const Route = createFileRoute("/browse")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Browse listings · SuqLink" }] }),
  component: Browse,
});

function Browse() {
  const { t, lang } = useI18n();
  const search = Route.useSearch();
  const nav = useNavigate({ from: "/browse" });
  const [localQ, setLocalQ] = useState(search.q);

  useEffect(() => { setLocalQ(search.q); }, [search.q]);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const selectedCat = cats?.find((c) => c.slug === search.category);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings", search],
    queryFn: async () => {
      let q = supabase
        .from("listings")
        .select("id, title, price, currency, location, condition, category_id, created_at, listing_images(url)")
        .eq("status", "active");
      if (selectedCat) q = q.eq("category_id", selectedCat.id);
      if (search.condition !== "any") q = q.eq("condition", search.condition);
      if (search.q) q = q.ilike("title", `%${search.q}%`);
      if (search.min > 0) q = q.gte("price", search.min);
      if (search.max > 0) q = q.lte("price", search.max);
      const order = search.sort === "cheap" ? { col: "price", asc: true } : search.sort === "pricy" ? { col: "price", asc: false } : { col: "created_at", asc: false };
      q = q.order(order.col, { ascending: order.asc }).limit(60);
      const { data } = await q;
      return data ?? [];
    },
  });

  const catName = (c: any) => (lang === "am" ? c.name_am : lang === "or" ? c.name_or : lang === "so" ? c.name_so : c.name_en) || c.name_en;
  const set = (patch: Partial<typeof search>) => nav({ search: (p: any) => ({ ...p, ...patch }) });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-3xl font-semibold">{t("nav_browse")}</h1>
          <form onSubmit={(e) => { e.preventDefault(); set({ q: localQ }); }} className="flex w-full max-w-md gap-2">
            <Input value={localQ} onChange={(e) => setLocalQ(e.target.value)} placeholder={t("search_placeholder")}
              className="bg-surface-2 border-border" />
            <Button type="submit" className="btn-hero">Search</Button>
          </form>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Filters */}
          <aside className="space-y-5 glow-card rounded-2xl p-5 h-fit">
            <h2 className="font-display text-lg">{t("filters")}</h2>
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">{t("category")}</Label>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => set({ category: "" })}
                  className={`rounded-full px-3 py-1 text-xs ${!search.category ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}>{t("any")}</button>
                {(cats ?? []).map((c) => (
                  <button key={c.id} onClick={() => set({ category: c.slug })}
                    className={`rounded-full px-3 py-1 text-xs ${search.category === c.slug ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}>
                    {catName(c)}
                  </button>
                ))}
              </div>
            </div>

            {(!selectedCat || selectedCat.supports_condition) && (
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">{t("condition")}</Label>
                <Select value={search.condition} onValueChange={(v: any) => set({ condition: v })}>
                  <SelectTrigger className="bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("any")}</SelectItem>
                    <SelectItem value="new">{t("new")}</SelectItem>
                    <SelectItem value="used">{t("used")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">{t("price_range")}</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Min" value={search.min || ""} onChange={(e) => set({ min: Number(e.target.value) || 0 })} className="bg-surface-2" />
                <Input type="number" placeholder="Max" value={search.max || ""} onChange={(e) => set({ max: Number(e.target.value) || 0 })} className="bg-surface-2" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">{t("sort_by")}</Label>
              <Select value={search.sort} onValueChange={(v: any) => set({ sort: v })}>
                <SelectTrigger className="bg-surface-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("newest")}</SelectItem>
                  <SelectItem value="cheap">{t("cheapest")}</SelectItem>
                  <SelectItem value="pricy">{t("priciest")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </aside>

          {/* Grid */}
          <div>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glow-card rounded-xl h-80 animate-pulse" />
                ))}
              </div>
            ) : (listings ?? []).length === 0 ? (
              <div className="glow-card rounded-2xl p-16 text-center text-muted-foreground">
                <Package className="mx-auto h-10 w-10 opacity-40" />
                <p className="mt-3">{t("no_results")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(listings ?? []).map((l: any) => (
                  <div key={l.id} className="group rounded-xl glow-card overflow-hidden transition hover:border-primary/50 hover:-translate-y-1 flex flex-col">
                    <Link to="/listings/$id" params={{ id: l.id }} className="block">
                      <div className="aspect-[4/3] bg-surface-2 overflow-hidden">
                        {l.listing_images?.[0]?.url ? (
                          <img src={publicUrl(l.listing_images[0].url)} alt={l.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full items-center justify-center"><Package className="h-10 w-10 opacity-40" /></div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="line-clamp-1 font-medium">{l.title}</div>
                        <div className="mt-1 text-lg font-bold text-gradient">{Number(l.price).toLocaleString()} {l.currency}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />{l.location ?? "—"}{l.condition ? ` · ${l.condition}` : ""}
                        </div>
                      </div>
                    </Link>
                    <div className="px-4 pb-4 mt-auto">
                      <BuyNowButton listingId={l.id} title={l.title} price={l.price} currency={l.currency} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
