import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createListing } from "@/lib/listings.functions";
import { uploadListingImage } from "@/lib/uploads.functions";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/seller/listings/new")({
  head: () => ({ meta: [{ title: "New listing · SuqLink" }] }),
  component: NewListing,
});

type Attr = { key: string; value: string };
type Contact = { type: "phone" | "telegram" | "instagram" | "whatsapp" | "in_app"; value: string };

function NewListing() {
  const { t } = useI18n();
  const nav = useNavigate();
  const create = useServerFn(createListing);
  const upload = useServerFn(uploadListingImage);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("ETB");
  const [condition, setCondition] = useState<"new" | "used" | "">("");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [attrs, setAttrs] = useState<Attr[]>([{ key: "", value: "" }]);
  const [contacts, setContacts] = useState<Contact[]>([{ type: "phone", value: "" }]);
  const [loading, setLoading] = useState(false);

  const cat = cats?.find((c) => c.id === categoryId);
  const showCondition = !cat || cat.supports_condition;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return toast.error("Choose a category");
    setLoading(true);
    try {
      // Upload images first
      const imagePaths: string[] = [];
      for (const f of files) {
        const b64 = await fileToBase64(f);
        const r = await upload({ data: { base64: b64, contentType: f.type } });
        imagePaths.push(r.path);
      }
      const r = await create({
        data: {
          categoryId, title, description,
          price: Number(price), currency,
          condition: showCondition && condition ? condition : null,
          location: location || undefined,
          imagePaths,
          attributes: attrs.filter((a) => a.key && a.value),
          contacts: contacts.filter((c) => c.value),
        },
      });
      toast.success("Listing posted!");
      nav({ to: "/listings/$id", params: { id: r.id } });
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">{t("create_listing")}</h1>
        <form onSubmit={submit} className="mt-6 space-y-5 glow-card rounded-2xl p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">{t("category")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="bg-surface-2"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {(cats ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("title")} <span className="text-muted-foreground text-xs">(e.g. "Phone — Samsung S22 Ultra")</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} className="bg-surface-2" />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">{t("description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required minLength={5}
              className="bg-surface-2 min-h-[120px]" placeholder="Tell buyers everything they should know…" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block">{t("price")}</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required className="bg-surface-2" />
            </div>
            <div>
              <Label className="mb-1.5 block">{t("currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-surface-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETB">ETB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("location")}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Addis Ababa, Bole" className="bg-surface-2" />
            </div>
          </div>

          {showCondition && (
            <div>
              <Label className="mb-1.5 block">{t("condition")}</Label>
              <div className="flex gap-2">
                {(["new", "used"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setCondition(c)}
                    className={`rounded-full px-4 py-1.5 text-sm ${condition === c ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>
                    {t(c as any)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          <div>
            <Label className="mb-1.5 block">{t("add_photos")}</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 p-4 hover:border-primary">
              <Upload className="h-4 w-4 text-accent" />
              <span className="text-sm text-muted-foreground flex-1">{files.length ? `${files.length} file(s) chosen` : "Click to choose photos…"}</span>
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))} />
            </label>
          </div>

          {/* Specs */}
          <div>
            <Label className="mb-1.5 block">Details</Label>
            <div className="space-y-2">
              {attrs.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={a.key} onChange={(e) => setAttrs((p) => p.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                    placeholder={t("spec_key")} className="bg-surface-2" />
                  <Input value={a.value} onChange={(e) => setAttrs((p) => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    placeholder={t("spec_value")} className="bg-surface-2" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setAttrs((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setAttrs((p) => [...p, { key: "", value: "" }])}
                className="bg-surface-2"><Plus className="h-4 w-4 mr-1" />{t("add_spec")}</Button>
            </div>
          </div>

          {/* Contacts */}
          <div>
            <Label className="mb-1.5 block">{t("contact_methods")}</Label>
            <div className="space-y-2">
              {contacts.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={c.type} onValueChange={(v: any) => setContacts((p) => p.map((x, j) => j === i ? { ...x, type: v } : x))}>
                    <SelectTrigger className="w-40 bg-surface-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="in_app">In-app only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={c.value} onChange={(e) => setContacts((p) => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    placeholder={c.type === "phone" || c.type === "whatsapp" ? "+251..." : "@handle"} className="bg-surface-2" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setContacts((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setContacts((p) => [...p, { type: "phone", value: "" }])}
                className="bg-surface-2"><Plus className="h-4 w-4 mr-1" />Add contact</Button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full btn-hero">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("submit")}
          </Button>
        </form>
      </main>
      <SiteFooter />
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
