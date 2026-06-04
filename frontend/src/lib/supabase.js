import { createClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "@/lib/runtimeEnv";

const url = getRuntimeEnv("REACT_APP_SUPABASE_URL");
const anon = getRuntimeEnv("REACT_APP_SUPABASE_ANON_KEY");

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn("[supabase] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY");
}

const replayableBodyFetch = async (...args) => {
  const response = await fetch(...args);
  const body = await response.arrayBuffer();
  const init = {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  };
  const bodyCopy = () => body.slice(0);
  const textFromBody = () => new TextDecoder().decode(bodyCopy());
  const makeResponse = () => new Response(bodyCopy(), init);
  const replayable = makeResponse();

  Object.defineProperty(replayable, "clone", {
    configurable: true,
    value: makeResponse,
  });
  Object.defineProperty(replayable, "arrayBuffer", {
    configurable: true,
    value: async () => bodyCopy(),
  });
  Object.defineProperty(replayable, "text", {
    configurable: true,
    value: async () => textFromBody(),
  });
  Object.defineProperty(replayable, "json", {
    configurable: true,
    value: async () => {
      const text = textFromBody();
      return text ? JSON.parse(text) : null;
    },
  });
  return replayable;
};

export const supabase = createClient(url || "https://example.supabase.co", anon || "missing-anon-key", {
  global: {
    fetch: replayableBodyFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_CONFIGURED = Boolean(url && anon);
