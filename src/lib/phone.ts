// Normalize to a loose E.164-ish format. Defaults Ethiopia (+251) if local form.
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  let s = input.replace(/[\s\-()]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    if (s.startsWith("0") && s.length >= 9) s = "+251" + s.slice(1);
    else if (/^\d{9,15}$/.test(s)) s = "+" + s;
    else return null;
  }
  if (!/^\+\d{8,15}$/.test(s)) return null;
  return s;
}

// Internal "fake" email used to satisfy Supabase auth (which requires email
// in the default flow). The phone is the user-facing identifier.
export function phoneToInternalEmail(phone: string): string {
  return `${phone.replace(/[^\d]/g, "")}@phone.suqlink.local`;
}
