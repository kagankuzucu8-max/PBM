import { createClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "@/lib/runtimeEnv";

const url = getRuntimeEnv("REACT_APP_SUPABASE_URL");
const anon = getRuntimeEnv("REACT_APP_SUPABASE_ANON_KEY");

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn("[supabase] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY");
}

const cachedBodyFetch = async (...args) => {
  const response = await fetch(...args);
  let textPromise = null;
  const readText = () => {
    if (!textPromise) textPromise = response.clone().text();
    return textPromise;
  };
  Object.defineProperty(response, "text", {
    configurable: true,
    value: readText,
  });
  Object.defineProperty(response, "json", {
    configurable: true,
    value: async () => {
      const text = await readText();
      return text ? JSON.parse(text) : null;
    },
  });
  return response;
};

export const supabase = createClient(url || "https://example.supabase.co", anon || "missing-anon-key", {
  global: {
    fetch: cachedBodyFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_CONFIGURED = Boolean(url && anon);
