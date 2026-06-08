import { handleRequest } from "./cloudflare/api.mjs";

const corsHeaders = (request) => ({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": request.headers.get("origin") || "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers":
    request.headers.get("access-control-request-headers") ||
    "content-type,authorization,x-pbm-supabase-url,x-pbm-supabase-anon-key",
  "access-control-max-age": "86400",
});

const apiError = (error, request) =>
  new Response(JSON.stringify({ detail: error?.message || "Internal server error" }), {
    status: error?.status || 500,
    headers: corsHeaders(request),
  });

const publicRuntimeEnv = (env) => ({
  REACT_APP_API_BASE: env.REACT_APP_API_BASE || "/api",
  REACT_APP_SUPABASE_URL: env.REACT_APP_SUPABASE_URL || env.SUPABASE_URL || "",
  REACT_APP_SUPABASE_ANON_KEY: env.REACT_APP_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "",
  REACT_APP_TURNSTILE_SITE_KEY: env.REACT_APP_TURNSTILE_SITE_KEY || "",
  REACT_APP_FIREBASE_API_KEY: env.REACT_APP_FIREBASE_API_KEY || "",
  REACT_APP_FIREBASE_AUTH_DOMAIN: env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  REACT_APP_FIREBASE_PROJECT_ID: env.REACT_APP_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || "",
  REACT_APP_FIREBASE_STORAGE_BUCKET: env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  REACT_APP_FIREBASE_APP_ID: env.REACT_APP_FIREBASE_APP_ID || "",
  REACT_APP_FIREBASE_VAPID_KEY: env.REACT_APP_FIREBASE_VAPID_KEY || "",
});

const withRuntimeEnv = async (response, env) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const config = JSON.stringify(publicRuntimeEnv(env)).replace(/</g, "\\u003c");
  const script = `<script>window.__PBM_ENV__=${config};</script>`;
  const html = (await response.text()).replace("</head>", `${script}</head>`);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const withRuntimeServiceWorker = async (response, env) => {
  const script = await response.text();
  const firebaseConfig = JSON.stringify({
    apiKey: env.REACT_APP_FIREBASE_API_KEY || "",
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || "",
    storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.REACT_APP_FIREBASE_APP_ID || "",
  }).replace(/</g, "\\u003c");
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(script.replace("/*__PBM_FIREBASE_CONFIG__*/ {}", firebaseConfig), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export default {
  async fetch(request, env) {
    globalThis.__PBM_ENV__ = {
      ...(env || {}),
      PBM_RUNTIME: "cloudflare-workers",
    };

    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      try {
        return await handleRequest(request);
      } catch (error) {
        return apiError(error, request);
      }
    }

    if (url.pathname === "/sw.js") {
      return withRuntimeServiceWorker(await env.ASSETS.fetch(request), env || {});
    }

    return withRuntimeEnv(await env.ASSETS.fetch(request), env || {});
  },
};
