import { handleRequest } from "../../netlify/functions/pbm.mjs";

const errorResponse = (error, request) =>
  new Response(JSON.stringify({ detail: error?.message || "Internal server error" }), {
    status: error?.status || 500,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": request.headers.get("origin") || "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":
        request.headers.get("access-control-request-headers") ||
        "content-type,authorization,x-pbm-supabase-url,x-pbm-supabase-anon-key",
    },
  });

export async function onRequest(context) {
  globalThis.__PBM_ENV__ = {
    ...(context.env || {}),
    PBM_RUNTIME: "cloudflare-pages-functions",
  };

  try {
    return await handleRequest(context.request);
  } catch (error) {
    return errorResponse(error, context.request);
  }
}
