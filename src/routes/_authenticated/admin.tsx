import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPendingSellers, reviewSeller } from "@/lib/listings.functions";
import { CheckCircle, XCircle, Users, ListChecks, ShieldCheck, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · SuqLink" }] }),
  beforeLoad: async ({ context }) => {
    const user = (context as any).user;
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"sellers" | "users" | "listings">("sellers");

  const tabs = [
    { id: "sellers", label: t("pending_sellers"), icon: ShieldCheck },
    { id: "users", label: t("all_users"), icon: Users },
    { id: "listings", label: t("all_listings"), icon: ListChecks },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">{t("admin")}</h1>
        <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
          {tabs.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id as any)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm ${tab === x.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <x.icon className="h-4 w-4" />{x.label}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "sellers" && <SellersTab />}
          {tab === "users" && <UsersTab />}
          {tab === "listings" && <ListingsTab />}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SellersTab() {
  const list = useServerFn(listPendingSellers);
  const review = useServerFn(reviewSeller);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-pending"],
    queryFn: async () => (await list()).rows,
  });
  const [reason, setReason] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);

  const act = async (sellerId: string, action: "approve" | "reject") => {
    try {
      await review({ data: { sellerId, action, reason: action === "reject" ? reason : undefined } });
      toast.success(`Seller ${action}d`);
      setOpenFor(null); setReason("");
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return <div className="text-muted-foreground">{`Loading…`}</div>;
  if (!data || data.length === 0) return <div className="glow-card rounded-2xl p-12 text-center text-muted-foreground">No sellers to review.</div>;

  return (
    <div className="space-y-4">
      {data.map((s: any) => (
        <div key={s.seller_id} className="glow-card rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium">{s.profiles?.full_name ?? "—"}</h3>
              <p className="text-sm text-muted-foreground">{s.profiles?.phone}</p>
              <p className="mt-1 text-xs uppercase tracking-wider">
                <span className={`rounded-full px-2 py-0.5 ${s.status === "approved" ? "bg-success/20 text-success" : s.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>{s.status}</span>
              </p>
            </div>
            {s.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act(s.seller_id, "approve")} className="bg-success text-success-foreground gap-1">
                  <CheckCircle className="h-4 w-4" />Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setOpenFor(s.seller_id)} className="gap-1">
                  <XCircle className="h-4 w-4" />Reject
                </Button>
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {s.id_front_signed && <img src={s.id_front_signed} className="rounded-lg border border-border" />}
            {s.id_back_signed && <img src={s.id_back_signed} className="rounded-lg border border-border" />}
          </div>
          {openFor === s.seller_id && (
            <div className="mt-3 flex gap-2">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rejection reason" className="bg-surface-2" />
              <Button size="sm" variant="destructive" onClick={() => act(s.seller_id, "reject")}>Confirm reject</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <div className="glow-card rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Joined</th></tr>
        </thead>
        <tbody>
          {(data ?? []).map((u: any) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-4 py-3">{u.full_name ?? "—"}</td>
              <td className="px-4 py-3">{u.phone}</td>
              <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListingsTab() {
  const { data } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => (await supabase.from("listings").select("id, title, price, currency, status, created_at, profiles!listings_seller_id_fkey(phone)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <div className="glow-card rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Status</th></tr>
        </thead>
        <tbody>
          {(data ?? []).map((l: any) => (
            <tr key={l.id} className="border-t border-border">
              <td className="px-4 py-3"><Link to="/listings/$id" params={{ id: l.id }} className="hover:text-accent">{l.title}</Link></td>
              <td className="px-4 py-3">{Number(l.price).toLocaleString()} {l.currency}</td>
              <td className="px-4 py-3 text-muted-foreground">{l.profiles?.phone}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{l.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
