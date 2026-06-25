import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Role = "buyer" | "seller" | "admin";

interface AuthCtx {
  user: User | null;
  roles: Role[];
  loading: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function fetchRoles(userId: string): Promise<Role[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as Role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    if (data.user) setRoles(await fetchRoles(data.user.id));
    else setRoles([]);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") { setUser(null); setRoles([]); return; }
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        setUser(session?.user ?? null);
        if (session?.user) setRoles(await fetchRoles(session.user.id));
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setRoles([]);
  };

  return (
    <Ctx.Provider value={{
      user, roles, loading,
      isBuyer: roles.includes("buyer"),
      isSeller: roles.includes("seller"),
      isAdmin: roles.includes("admin"),
      refresh, signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
