import { createClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "@/lib/runtimeEnv";

const url = getRuntimeEnv("REACT_APP_SUPABASE_URL");
const anon = getRuntimeEnv("REACT_APP_SUPABASE_ANON_KEY");
const projectRef = url ? new URL(url).hostname.split(".")[0] : "missing-project";
const storageKey = `sb-${projectRef}-auth-token`;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn("[supabase] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url || "https://example.supabase.co", anon || "missing-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey,
  },
});

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anon;
export const SUPABASE_STORAGE_KEY = storageKey;
export const SUPABASE_CONFIGURED = Boolean(url && anon);

export function readStoredSupabaseSession() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredSupabaseSession() {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(`${storageKey}-user`);
  window.localStorage.removeItem(`${storageKey}-code-verifier`);
}
