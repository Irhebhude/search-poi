import { useEffect, useState } from "react";
import { api as supabase } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user) {
        if (active) { setIsAdmin(false); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (active) { setIsAdmin(!!data); setLoading(false); }
    };
    if (!authLoading) check();
    return () => { active = false; };
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}
