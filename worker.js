import { handleRequest } from "./netlify/functions/pbm.mjs";

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

    return env.ASSETS.fetch(request);
  },
};
