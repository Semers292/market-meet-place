import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { SignedImg } from "@/components/SignedImg";
import { Plus, Clock, CheckCircle, XCircle, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/seller/dashboard")({
  head: () => ({ meta: [{ title: "Seller dashboard · SuqLink" }] }),
  component: SellerDashboard,
});

function SellerDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();

  const { data: verification } = useQuery({
    queryKey: ["verification", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("seller_verifications").select("*").eq("seller_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: listings } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("listings")
        .select("id, title, price, currency, status, listing_images(url)")
        .eq("seller_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const status = verification?.status ?? "pending";

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold">{t("nav_dashboard")}</h1>
          {status === "approved" && (
            <Link to="/seller/listings/new">
              <Button className="btn-hero gap-2"><Plus className="h-4 w-4" />{t("create_listing")}</Button>
            </Link>
          )}
        </div>

        {/* Verification banner */}
        <div className="mt-6 glow-card rounded-2xl p-5">
          {status === "pending" && (
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <h3 className="font-medium">{t("awaiting_approval")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">An admin is reviewing your National ID. You'll be notified by SMS when approved.</p>
              </div>
            </div>
          )}
          {status === "approved" && (
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success mt-0.5" />
              <div><h3 className="font-medium">Verified seller</h3>
              <p className="mt-1 text-sm text-muted-foreground">You're all set. Start posting listings.</p></div>
            </div>
          )}
          {status === "rejected" && (
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-medium">{t("approval_rejected")}</h3>
                {verification?.rejection_reason && (
                  <p className="mt-1 text-sm text-muted-foreground">{t("reason")}: {verification.rejection_reason}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Listings */}
        <h2 className="mt-10 font-display text-xl">{t("my_listings")}</h2>
        {!listings || listings.length === 0 ? (
          <div className="mt-3 glow-card rounded-2xl p-12 text-center text-muted-foreground">
            <Package className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-3">No listings yet.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l: any) => (
              <Link key={l.id} to="/listings/$id" params={{ id: l.id }}
                className="rounded-xl glow-card overflow-hidden hover:border-primary/50">
                <div className="aspect-[4/3] bg-surface-2">
                  {l.listing_images?.[0]?.url && <img src={publicUrl(l.listing_images[0].url)} className="h-full w-full object-cover" />}
                </div>
                <div className="p-3">
                  <div className="line-clamp-1 font-medium">{l.title}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gradient font-semibold">{Number(l.price).toLocaleString()} {l.currency}</div>
                    <span className="text-[10px] uppercase rounded-full bg-surface-2 px-2 py-0.5">{l.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
