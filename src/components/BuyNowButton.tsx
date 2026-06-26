import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { requestBuyNow } from "@/lib/buy.functions";
import { ADMIN_CONTACT } from "@/lib/admin-contact";
import { ShoppingBag, Phone, MessageCircle, Send, CheckCircle2, Shield, Sparkles } from "lucide-react";

export function BuyNowButton({ listingId, title, price, currency }: {
  listingId: string; title: string; price: number | string; currency: string;
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const send = useServerFn(requestBuyNow);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onClick = () => {
    if (!user) {
      toast.info("Please sign up to continue your purchase");
      nav({ to: "/auth", search: { mode: "signup-buyer" } as never });
      return;
    }
    setOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await send({ data: { listingId, note: note.trim() || undefined } });
      setDone(true);
      toast.success("Our broker has been notified");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send request");
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <button onClick={onClick} className="btn-buy group relative w-full overflow-hidden rounded-xl px-6 py-4 font-display text-base font-semibold">
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          <ShoppingBag className="h-5 w-5 transition-transform group-hover:rotate-[-8deg]" />
          Buy Now
          <Sparkles className="h-4 w-4 opacity-80 animate-pulse-glow" />
        </span>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setDone(false); setNote(""); } }}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {done ? "Request received 🎉" : "Confirm your purchase"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {done
                ? "Our broker will reach out shortly. Meanwhile you can contact us directly:"
                : "A SuqLink broker will verify the deal and contact you within minutes."}
            </DialogDescription>
          </DialogHeader>

          {!done ? (
            <div className="space-y-4">
              <div className="glow-card rounded-xl p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Item</div>
                <div className="mt-1 font-medium">{title}</div>
                <div className="mt-2 text-2xl font-bold text-gradient">
                  {Number(price).toLocaleString()} {currency}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-4 w-4 text-accent" />
                Secured & verified through SuqLink broker
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional message to the broker (delivery, negotiation…)"
                className="min-h-[90px] bg-surface-2 border-border"
              />
              <Button onClick={submit} disabled={submitting} className="btn-hero w-full gap-2">
                <Send className="h-4 w-4" />
                {submitting ? "Sending…" : "Send request to broker"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm">Broker notified about “{title}”.</span>
              </div>
              <div className="grid gap-2">
                <a href={`tel:${ADMIN_CONTACT.phone}`} className="contact-row group">
                  <Phone className="h-5 w-5 text-accent" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Call broker</div>
                    <div className="text-xs text-muted-foreground">{ADMIN_CONTACT.phone}</div>
                  </div>
                </a>
                <a href={`https://t.me/${ADMIN_CONTACT.telegram}`} target="_blank" rel="noreferrer" className="contact-row group">
                  <Send className="h-5 w-5 text-[#229ED9]" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Telegram</div>
                    <div className="text-xs text-muted-foreground">@{ADMIN_CONTACT.telegram}</div>
                  </div>
                </a>
                <a href={`https://wa.me/${ADMIN_CONTACT.whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="contact-row group">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">WhatsApp</div>
                    <div className="text-xs text-muted-foreground">{ADMIN_CONTACT.whatsapp}</div>
                  </div>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
