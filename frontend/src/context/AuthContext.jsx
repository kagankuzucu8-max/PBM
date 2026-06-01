import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAccountStatus } from "@/lib/api";

const AuthContext = createContext(null);
const ADMIN_DISPLAY_NAMES = {
  "kaankuzucub@gmail.com": "kaanxbt",
};

async function ensureUserBootstrap(user) {
  if (!user?.id) return;
  await supabase.from("user_settings").upsert({
    user_id: user.id,
    default_timeframe: "1h",
    default_market: "crypto",
    theme: "light",
  }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: lists } = await supabase
    .from("watchlists")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (!lists || lists.length === 0) {
    await supabase.from("watchlists").insert({ user_id: user.id, name: "My Watchlist" });
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");

  const refreshAccount = useCallback(async () => {
    setAccountError("");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      setAccount(null);
      return null;
    }
    setAccountLoading(true);
    try {
      const status = await getAccountStatus();
      setAccount(status);
      return status;
    } catch (error) {
      const detail = error.response?.data?.detail || error.message || "Account status unavailable";
      setAccountError(detail);
      return null;
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const currentSession = data.session;
      const currentUser = currentSession?.user ?? null;
      setSession(currentSession);
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        ensureUserBootstrap(currentUser).catch(() => {});
        refreshAccount().catch(() => {});
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => {
          ensureUserBootstrap(sess.user).catch(() => {});
          refreshAccount().catch(() => {});
        }, 0);
      } else {
        setAccount(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshAccount]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
    if (data.user) await ensureUserBootstrap(data.user);
    refreshAccount().catch(() => {});
  };
  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
    if (data.user) await ensureUserBootstrap(data.user);
    refreshAccount().catch(() => {});
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    setAccount(null);
  };

  const emailKey = String(user?.email || "").toLowerCase();
  const knownAdmin = Boolean(ADMIN_DISPLAY_NAMES[emailKey]);
  const displayName = knownAdmin ? ADMIN_DISPLAY_NAMES[emailKey] : user?.email?.split("@")[0] || "";

  return (
    <AuthContext.Provider value={{
      session,
      user,
      loading,
      account,
      accountLoading,
      accountError,
      access: account?.access || null,
      isAdmin: Boolean(knownAdmin && account?.is_admin),
      aiUsage: account?.usage?.ai_analysis || null,
      displayName,
      refreshAccount,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
