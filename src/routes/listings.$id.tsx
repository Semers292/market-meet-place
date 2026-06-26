import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { publicUrl } from "./index";
import { notifySellerInquiry } from "@/lib/messages.functions";
import { Phone, Send, MapPin, Calendar, MessageSquare } from "lucide-react";
import { BuyNowButton } from "@/components/BuyNowButton";

export const Route = createFileRoute("/listings/$id")({
  head: ({ params }) => ({ meta: [{ title: `Listing · SuqLink` }] }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const notify = useServerFn(notifySellerInquiry);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(`
          *, listing_images(url, sort_order), listing_attributes(key, value),
          contact_options(type, value),
          categories(slug, name_en),
          profiles!listings_seller_id_fkey(full_name, phone)
        `)
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const send = async () => {
    if (!user) { nav({ to: "/auth" }); return; }
    if (!msg.trim()) return;
    setSending(true);
    try {
      await notify({ data: { listingId: id, message: msg } });
      toast.success("Message sent!");
      setMsg("");
    } catch (e: any) { toast.error(e.message); } finally { setSending(false); }
  };

  if (isLoading || !listing) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 mx-auto max-w-6xl px-4 py-12">
          <div className="glow-card rounded-2xl h-96 animate-pulse" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const images = (listing.listing_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link to="/browse" className="text-sm text-muted-foreground hover:text-foreground">← {t("nav_browse")}</Link>
        <div className="mt-4 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Gallery */}
          <div className="space-y-3">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl glow-card">
              {images[0]?.url ? (
                <img src={publicUrl(images[0].url)} alt={listing.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">No image</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.slice(1).map((img: any, i: number) => (
                  <img key={i} src={publicUrl(img.url)} className="aspect-square w-full rounded-lg object-cover glow-card" />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-3xl font-semibold">{listing.title}</h1>
              <div className="mt-2 text-3xl font-bold text-gradient">{Number(listing.price).toLocaleString()} {listing.currency}</div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                {listing.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{listing.location}</span>}
                {listing.condition && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{listing.condition}</span>}
                <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(listing.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {listing.listing_attributes?.length > 0 && (
              <div className="glow-card rounded-xl p-4">
                <h3 className="mb-2 text-sm font-medium">Details</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {listing.listing_attributes.map((a: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <dt className="text-muted-foreground">{a.key}:</dt>
                      <dd>{a.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{listing.description}</p>

            <BuyNowButton listingId={listing.id} title={listing.title} price={listing.price} currency={listing.currency} />

            {/* Contact */}
            <div className="glow-card rounded-xl p-4">
              <h3 className="mb-3 font-medium">{t("contact_seller")}</h3>
              <div className="flex flex-wrap gap-2">
                {(listing.contact_options ?? []).map((c: any, i: number) => (
                  <ContactPill key={i} type={c.type} value={c.value} />
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("message")}
                  className="bg-surface-2 border-border min-h-[100px]" />
                <Button onClick={send} disabled={sending || !msg.trim()} className="w-full btn-hero gap-2">
                  <Send className="h-4 w-4" />{t("send")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ContactPill({ type, value }: { type: string; value: string }) {
  let href = "#"; let label = value;
  if (type === "phone" || type === "whatsapp") href = `tel:${value}`;
  if (type === "whatsapp") href = `https://wa.me/${value.replace(/[^\d]/g, "")}`;
  if (type === "telegram") href = `https://t.me/${value.replace(/^@/, "")}`;
  if (type === "instagram") href = `https://instagram.com/${value.replace(/^@/, "")}`;
  if (type === "in_app") return null;
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm hover:border-primary hover:bg-surface">
      {type === "phone" ? <Phone className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
      <span className="capitalize">{type}</span>: {label}
    </a>
  );
}
