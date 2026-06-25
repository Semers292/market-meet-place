import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/buyer/dashboard")({
  head: () => ({ meta: [{ title: "Buyer dashboard · SuqLink" }] }),
  component: BuyerDashboard,
});

function BuyerDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: messages } = useQuery({
    queryKey: ["my-messages", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, body, created_at, listing_id, sender_id, recipient_id, listings(title)")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold">{t("nav_dashboard")}</h1>
          <Link to="/browse"><Button className="btn-hero gap-2"><Search className="h-4 w-4" />{t("nav_browse")}</Button></Link>
        </div>



        <h2 className="mt-8 font-display text-xl flex items-center gap-2"><Mail className="h-5 w-5 text-accent" />Messages</h2>
        {!messages || messages.length === 0 ? (
          <div className="mt-3 glow-card rounded-2xl p-12 text-center text-muted-foreground">No messages yet.</div>
        ) : (
          <ul className="mt-4 space-y-2">
            {messages.map((m: any) => (
              <li key={m.id} className="glow-card rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{m.sender_id === user?.id ? "You sent" : "Received"}</span>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>
                {m.listings?.title && (
                  <Link to="/listings/$id" params={{ id: m.listing_id }} className="text-sm text-accent hover:underline">
                    {m.listings.title}
                  </Link>
                )}
                <p className="mt-1 text-sm">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
