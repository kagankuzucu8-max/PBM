import { handleRequest } from "./cloudflare/api.mjs";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://pbmdesk.pbmsolutions.workers.dev",
  "https://pbmsolutions.com",
  "https://www.pbmsolutions.com",
];

const configuredAllowedOrigins = (env) =>
  String(env?.PBM_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const isAllowedOrigin = (request, env) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) return true;
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredAllowedOrigins(env)]);
  if (env?.PBM_ALLOW_LOCALHOST === "true" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }
  return allowed.has(origin);
};

const corsHeaders = (request, env) => {
  const origin = request.headers.get("origin");
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "600",
    vary: "Origin",
  };
  if (origin && isAllowedOrigin(request, env)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
};

const securityHeaders = (nonce = "") => ({
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""} https://challenges.cloudflare.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://fcmregistrations.googleapis.com https://*.googleapis.com",
    "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://s.tradingview.com https://www.tradingview.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-permitted-cross-domain-policies": "none",
});

const withSecurityHeaders = (response, nonce = "") => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders(nonce))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const apiError = (error, request, env) =>
  new Response(JSON.stringify({ detail: error?.message || "Internal server error" }), {
    status: error?.status || 500,
    headers: corsHeaders(request, env),
  });

const forbiddenOrigin = (request, env) =>
  new Response(JSON.stringify({ detail: "Origin is not allowed" }), {
    status: 403,
    headers: corsHeaders(request, env),
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

const withRuntimeEnv = async (response, env, nonce) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const config = JSON.stringify(publicRuntimeEnv(env)).replace(/</g, "\\u003c");
  const script = `<script nonce="${nonce}">window.__PBM_ENV__=${config};</script>`;
  const html = (await response.text())
    .replace(/<script(?![^>]*\bsrc=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`)
    .replace("</head>", `${script}</head>`);
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
      if (!isAllowedOrigin(request, env || {})) {
        return withSecurityHeaders(forbiddenOrigin(request, env || {}));
      }
      try {
        return withSecurityHeaders(await handleRequest(request));
      } catch (error) {
        return withSecurityHeaders(apiError(error, request, env || {}));
      }
    }

    if (url.pathname === "/sw.js") {
      return withSecurityHeaders(await withRuntimeServiceWorker(await env.ASSETS.fetch(request), env || {}));
    }

    const nonce = crypto.randomUUID().replace(/-/g, "");
    return withSecurityHeaders(await withRuntimeEnv(await env.ASSETS.fetch(request), env || {}, nonce), nonce);
  },
};
