import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  clearStoredSupabaseSession,
  readStoredSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_STORAGE_KEY,
  SUPABASE_URL,
  supabase,
} from "@/lib/supabase";
import { getAccountStatus } from "@/lib/api";

const AuthContext = createContext(null);
const ADMIN_DISPLAY_NAMES = {
  "kagankuzucu8@gmail.com": "kaanxbt",
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

function postJsonWithXHR(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.onload = () => {
      let body = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = { message: xhr.responseText };
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.ontimeout = () => reject(new Error("Network request timed out"));
    xhr.timeout = 30000;
    xhr.send(JSON.stringify(payload));
  });
}

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
  const { ok, body } = await postJsonWithXHR(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    { email, password },
  );
  if (!ok) {
    throw new Error(body?.error_description || body?.msg || body?.message || "Authentication failed");
  }
  if (!body?.access_token || !body?.refresh_token) {
    throw new Error("Supabase did not return a session");
  }
  const directSession = buildDirectSession(body, email);
  persistDirectSession(directSession);
  return { data: { session: directSession, user: directSession.user }, error: null };
}

async function directSignUp(email, password) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars are missing");
  }
  const { ok, body } = await postJsonWithXHR(
    `${SUPABASE_URL}/auth/v1/signup`,
    {
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    { email, password },
  );
  if (!ok) {
    throw new Error(body?.error_description || body?.msg || body?.message || "Sign up failed");
  }
  if (body?.access_token && body?.refresh_token) {
    const directSession = buildDirectSession(body, email);
    persistDirectSession(directSession);
    return { data: { session: directSession, user: directSession.user }, error: null };
  }
  return { data: { session: null, user: body?.user || null }, error: null };
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
    const currentSession = readStoredSupabaseSession();
    if (!currentSession?.user) {
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
    const currentSession = readStoredSupabaseSession();
    const currentUser = currentSession?.user ?? null;
    setSession(currentSession);
    setUser(currentUser);
    setLoading(false);
    if (currentUser) {
      ensureUserBootstrap(currentUser).catch(() => {});
      refreshAccount().catch(() => {});
    }
    const syncStoredSession = () => {
      if (!mounted) return;
      const stored = readStoredSupabaseSession();
      setSession(stored);
      setUser(stored?.user ?? null);
      if (stored?.user) {
        ensureUserBootstrap(stored.user).catch(() => {});
        refreshAccount().catch(() => {});
      } else {
        setAccount(null);
      }
    };
    window.addEventListener("storage", syncStoredSession);
    return () => {
      mounted = false;
      window.removeEventListener("storage", syncStoredSession);
    };
  }, [refreshAccount]);

  const signIn = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    const result = await directPasswordSignIn(cleanEmail, password);
    const { data, error } = result;
    if (error) throw error;
    if (data.session) setSession(data.session);
    if (data.user) setUser(data.user);
    if (data.user) ensureUserBootstrap(data.user).catch(() => {});
    refreshAccount().catch(() => {});
  };
  const signUp = async (email, password) => {
    const { data, error } = await directSignUp(email.trim().toLowerCase(), password);
    if (error) throw error;
    if (data.session) setSession(data.session);
    if (data.user) setUser(data.user);
    if (data.user) ensureUserBootstrap(data.user).catch(() => {});
    refreshAccount().catch(() => {});
  };
  const signOut = async () => {
    clearStoredSupabaseSession();
    setSession(null);
    setUser(null);
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
