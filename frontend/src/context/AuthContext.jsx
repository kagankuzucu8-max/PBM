import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_STORAGE_KEY, SUPABASE_URL, supabase } from "@/lib/supabase";
import { getAccountStatus } from "@/lib/api";

const AuthContext = createContext(null);
const ADMIN_DISPLAY_NAMES = {
  "kaankuzucub@gmail.com": "kaanxbt",
};

async function ensureUserBootstrap(user) {
  if (!user?.id) return;
  try {
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
  } catch {
    // Login should not fail if optional first-run workspace bootstrap is blocked.
  }
}

const isBodyStreamError = (error) =>
  /body stream|body is already|already read|already used/i.test(String(error?.message || error || ""));

function parseJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function buildDirectSession(body, email) {
  const payload = parseJwtPayload(body.access_token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = body.expires_at || payload.exp || now + (body.expires_in || 3600);
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    token_type: body.token_type || "bearer",
    expires_in: body.expires_in || Math.max(expiresAt - now, 0),
    expires_at: expiresAt,
    user: body.user || {
      id: payload.sub,
      aud: payload.aud || "authenticated",
      role: payload.role || "authenticated",
      email,
    },
  };
}

function persistDirectSession(session) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify(session));
  if (session.user) {
    window.localStorage.setItem(`${SUPABASE_STORAGE_KEY}-user`, JSON.stringify(session.user));
  }
}

async function directPasswordSignIn(email, password) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars are missing");
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  if (!response.ok) {
    throw new Error(body?.error_description || body?.msg || body?.message || "Authentication failed");
  }
  if (!body?.access_token || !body?.refresh_token) {
    throw new Error("Supabase did not return a session");
  }
  const directSession = buildDirectSession(body, email);
  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    if (!error) return { data: data || { session: directSession, user: directSession.user }, error: null };
    if (!isBodyStreamError(error)) throw error;
  } catch (error) {
    if (!isBodyStreamError(error)) throw error;
  }
  persistDirectSession(directSession);
  return { data: { session: directSession, user: directSession.user }, error: null };
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
    const cleanEmail = email.trim().toLowerCase();
    let result;
    try {
      result = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    } catch (error) {
      if (!isBodyStreamError(error)) throw error;
      result = await directPasswordSignIn(cleanEmail, password);
    }
    if (isBodyStreamError(result?.error)) {
      result = await directPasswordSignIn(cleanEmail, password);
    }
    const { data, error } = result;
    if (error) throw error;
    if (data.session) setSession(data.session);
    if (data.user) setUser(data.user);
    if (data.user) ensureUserBootstrap(data.user).catch(() => {});
    refreshAccount().catch(() => {});
  };
  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
    if (data.user) ensureUserBootstrap(data.user).catch(() => {});
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
