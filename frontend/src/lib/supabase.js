import { createClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "@/lib/runtimeEnv";

const url = getRuntimeEnv("REACT_APP_SUPABASE_URL");
const anon = getRuntimeEnv("REACT_APP_SUPABASE_ANON_KEY");

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn("[supabase] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url || "https://example.supabase.co", anon || "missing-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anon;
export const SUPABASE_CONFIGURED = Boolean(url && anon);
