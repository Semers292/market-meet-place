import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminStatus, adminUnlock, adminLock,
  adminListPendingSellers, adminReviewSeller,
  adminListUsers, adminListListings, adminReviewListing,
} from "@/lib/admin-gate.functions";
import { CheckCircle, XCircle, Users, ListChecks, ShieldCheck, Lock, LogOut, Clock } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · SuqLink" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminGate,
});

function AdminGate() {
  const status = useServerFn(adminStatus);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => status(),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 grid place-items-center text-muted-foreground">Loading…</main>
        <SiteFooter />
      </div>
    );
  }
  if (!data?.unlocked) return <UnlockScreen onUnlocked={() => refetch()} />;
  return <AdminPanel onLocked={() => refetch()} />;
}

function UnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const unlock = useServerFn(adminUnlock);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await unlock({ data: { password: pw } });
      if (res.ok) { toast.success("Welcome, admin."); onUnlocked(); }
      else toast.error("Incorrect password");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); setPw(""); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4">
        <form onSubmit={submit} className="glow-card w-full max-w-md rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Admin portal</h1>
              <p className="text-sm text-muted-foreground">Enter the admin password to continue.</p>
            </div>
          </div>
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="bg-surface-2"
          />
          <Button type="submit" disabled={busy || !pw} className="btn-hero w-full">
            {busy ? "Checking…" : "Unlock"}
          </Button>
          <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}

function AdminPanel({ onLocked }: { onLocked: () => void }) {
  const lock = useServerFn(adminLock);
  const [tab, setTab] = useState<"sellers" | "pending-listings" | "users" | "listings">("pending-listings");
  const tabs = [
    { id: "pending-listings", label: "Pending listings", icon: Clock },
    { id: "sellers", label: "Pending sellers", icon: ShieldCheck },
    { id: "users", label: "All users", icon: Users },
    { id: "listings", label: "All listings", icon: ListChecks },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold">Admin</h1>
          <Button variant="outline" size="sm" className="gap-2" onClick={async () => { await lock(); onLocked(); toast.success("Locked"); }}>
            <LogOut className="h-4 w-4" />Lock
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
          {tabs.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id as any)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm ${tab === x.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <x.icon className="h-4 w-4" />{x.label}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "pending-listings" && <PendingListingsTab />}
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
  const list = useServerFn(adminListPendingSellers);
  const review = useServerFn(adminReviewSeller);
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

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
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
  const list = useServerFn(adminListUsers);
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: async () => (await list()).rows });
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
  const list = useServerFn(adminListListings);
  const { data } = useQuery({ queryKey: ["admin-listings"], queryFn: async () => (await list()).rows });
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
