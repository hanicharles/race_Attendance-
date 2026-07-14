import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "teacher" | "student";

export interface AuthSession {
  access_token: string;
  user: {
    id: string;
    email: string;
  };
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async (s: AuthSession | null) => {
      if (!mounted) return;
      setSession(s);
      if (!s) {
        if (role !== null) setRole(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", s.user.id)
        .maybeSingle();
      if (!mounted) return;
      setRole((data?.role as Role) ?? null);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session as AuthSession | null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e: string, s: AuthSession | null) =>
      load(s),
    );
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [role]);

  return { session, user: session?.user ?? null, role, loading };
}

export async function signOut() {
  await supabase.auth.signOut();
}
