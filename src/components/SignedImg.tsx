import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export async function getSignedListingImage(path: string): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const cached = cache.get(path);
  if (cached) return cached;
  const existing = inflight.get(path);
  if (existing) return existing;
  const p = (async () => {
    const { data, error } = await supabase.storage
      .from("listing-images")
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) throw error ?? new Error("sign failed");
    cache.set(path, data.signedUrl);
    return data.signedUrl;
  })();
  inflight.set(path, p);
  try { return await p; } finally { inflight.delete(path); }
}

export function SignedImg({ path, alt, className }: { path?: string | null; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string>(() => (path && cache.get(path)) || "");
  useEffect(() => {
    let on = true;
    if (!path) { setUrl(""); return; }
    getSignedListingImage(path).then((u) => { if (on) setUrl(u); }).catch(() => {});
    return () => { on = false; };
  }, [path]);
  if (!url) return <div className={className} style={{ background: "rgba(255,255,255,0.04)" }} />;
  return <img src={url} alt={alt} className={className} />;
}
