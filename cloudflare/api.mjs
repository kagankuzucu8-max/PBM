const OKX = "https://www.okx.com";
const BINANCE = "https://api.binance.com";
const COINPAPRIKA = "https://api.coinpaprika.com/v1";
const COINGECKO = "https://api.coingecko.com/api/v3";
const TWELVE = "https://api.twelvedata.com";
const YAHOO = "https://query1.finance.yahoo.com";
const RESEND = "https://api.resend.com/emails";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const POPULAR_CRYPTO = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "ADAUSDT", "AVAXUSDT", "DOGEUSDT", "LINKUSDT", "MATICUSDT",
  "DOTUSDT", "ARBUSDT", "OPUSDT", "INJUSDT", "SUIUSDT",
];
const POPULAR_FOREX = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURJPY"];
const POPULAR_INDICES = ["SPX", "NDX", "DJI", "IXIC", "RUT", "DAX", "FTSE", "N225"];
const ADMIN_EMAILS = new Set(["kagankuzucu8@gmail.com"]);
let firebaseAccessTokenCache = null;
const FOREX_CODES = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "TRY", "CNH", "SEK", "NOK", "DKK", "MXN", "ZAR"]);
const INDEX_ALIASES = new Map([
  ["SPX", "SPX"],
  ["SP500", "SPX"],
  ["NDX", "NDX"],
  ["NASDAQ100", "NDX"],
  ["DJI", "DJI"],
  ["DOW", "DJI"],
  ["IXIC", "IXIC"],
  ["RUT", "RUT"],
  ["DAX", "DAX"],
  ["FTSE", "FTSE"],
  ["N225", "N225"],
]);

const getEnv = (name) => {
  if (globalThis.__PBM_ENV__ && Object.prototype.hasOwnProperty.call(globalThis.__PBM_ENV__, name)) {
    return globalThis.__PBM_ENV__[name];
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }
  return undefined;
};

const json = (body, status = 200, request) => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (request) {
    Object.assign(headers, corsHeaders(request));
  }
  return new Response(JSON.stringify(body), { status, headers });
};

const corsHeaders = (request) => ({
  "access-control-allow-origin": request.headers.get("origin") || "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers":
    request.headers.get("access-control-request-headers") ||
    "content-type,authorization,x-pbm-supabase-url,x-pbm-supabase-anon-key",
  "access-control-max-age": "86400",
});

const withCors = (response, request) => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const routePath = (request) => {
  const url = new URL(request.url);
  const path = url.pathname
    .replace(/^\/api\/?/, "/");
  return path === "" ? "/" : path;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const requestJson = async (request) => {
  try {
    return await request.json();
  } catch {
    throw httpError(400, "Invalid JSON body");
  }
};

const httpError = (status, detail) => {
  const error = new Error(detail);
  error.status = status;
  return error;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "PBM/1.0",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw httpError(response.status, typeof body === "string" ? body : JSON.stringify(body));
  }
  return body;
};

const supabaseHintsFromRequest = (request) => ({
  url: request?.headers?.get?.("x-pbm-supabase-url") || "",
  anonKey: request?.headers?.get?.("x-pbm-supabase-anon-key") || "",
});

const supabaseConfig = (hints = {}) => {
  const url = (getEnv("SUPABASE_URL") || getEnv("REACT_APP_SUPABASE_URL") || hints.url || "").replace(/\/+$/, "");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY") || getEnv("SUPABASE_SERVICE_ROLE");
  const anonKey = getEnv("SUPABASE_ANON_KEY") || getEnv("REACT_APP_SUPABASE_ANON_KEY") || hints.anonKey;
  if (!url || (!serviceKey && !anonKey)) {
    throw httpError(500, "Set SUPABASE_URL and SUPABASE_ANON_KEY in server environment variables");
  }
  return { url, serviceKey, anonKey, key: serviceKey || anonKey };
};

const hasSupabaseServiceKey = () =>
  Boolean(getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY") || getEnv("SUPABASE_SERVICE_ROLE"));

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const text =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const supabaseAdminJson = async (path, options = {}) => {
  const { url, serviceKey, anonKey, key } = supabaseConfig(options.supabaseHints);
  const userToken = options.userToken;
  const forceService = options.service === true;
  const useService = forceService ? Boolean(serviceKey) : Boolean(serviceKey && !userToken);
  const apiKey = useService ? serviceKey : (anonKey || serviceKey || key);
  const bearer = useService ? serviceKey : (userToken || apiKey);
  const { userToken: _userToken, service: _service, supabaseHints: _supabaseHints, ...fetchOptions } = options;
  const response = await fetch(`${url}/rest/v1/${path.replace(/^\/+/, "")}`, {
    ...fetchOptions,
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${bearer}`,
      "content-type": "application/json",
      ...(fetchOptions.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw httpError(response.status, typeof body === "string" ? body : JSON.stringify(body));
  }
  return body;
};

const authenticatedUser = async (request) => {
  const auth = request.headers.get("authorization") || "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw httpError(401, "Sign in is required");
  const supabaseHints = supabaseHintsFromRequest(request);
  supabaseConfig(supabaseHints);
  const claims = decodeJwtPayload(token);
  const id = claims?.sub;
  const email = String(claims?.email || claims?.user_metadata?.email || "").trim().toLowerCase();
  const exp = Number(claims?.exp || 0);
  if (!id || !email) {
    throw httpError(401, "Invalid session");
  }
  if (exp && exp * 1000 < Date.now()) {
    throw httpError(401, "Session expired");
  }
  return { id, email, token, supabaseHints };
};

const fetchBetaAccess = async (email, userToken, supabaseHints) => {
  const params = new URLSearchParams({
    select: "*",
    email: `eq.${email}`,
    limit: "1",
  });
  try {
    const rows = await supabaseAdminJson(`beta_access?${params}`, { userToken, supabaseHints });
    return Array.isArray(rows) ? rows[0] : null;
  } catch {
    return null;
  }
};

const defaultUserAccess = (email) => ({
  email,
  role: "user",
  status: "active",
  weekly_ai_limit: 10,
  daily_ai_limit: 10,
  can_post_social: false,
  can_add_education: false,
  can_use_ai_analysis: true,
  can_use_pbm_brain: false,
});

const requireBetaUser = async (request) => {
  const user = await authenticatedUser(request);
  let access = await fetchBetaAccess(user.email, user.token, user.supabaseHints);
  if (!access && ADMIN_EMAILS.has(user.email)) {
    access = {
      email: user.email,
      role: "admin",
      status: "active",
      weekly_ai_limit: 9999,
      daily_ai_limit: 9999,
      can_post_social: true,
      can_add_education: true,
      can_use_ai_analysis: true,
      can_use_pbm_brain: true,
    };
  }
  if (!access) {
    access = defaultUserAccess(user.email);
    if (hasSupabaseServiceKey()) {
      try {
        const rows = await supabaseAdminJson("beta_access?on_conflict=email", {
          method: "POST",
          service: true,
          supabaseHints: user.supabaseHints,
          headers: { prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(access),
        });
        if (Array.isArray(rows) && rows[0]) access = rows[0];
      } catch {
        // Existing accounts must remain usable even if access bootstrap is temporarily unavailable.
      }
    }
  }
  return { user, access, isAdmin: access.role === "admin" && ADMIN_EMAILS.has(user.email) };
};

const featureEnabled = (auth, feature) => {
  if (auth.isAdmin) return true;
  if (feature === "ai_analysis") return auth.access.can_use_ai_analysis !== false;
  if (feature === "pbm_brain") return auth.access.can_use_pbm_brain === true;
  return false;
};

const requireFeature = (auth, feature, detail) => {
  if (!featureEnabled(auth, feature)) throw httpError(403, detail);
};

const dayStartDate = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
};

const usageState = async ({ user, access, isAdmin }, action = "ai_analysis") => {
  const periodStart = dayStartDate();
  const params = new URLSearchParams({
    select: "id",
    user_id: `eq.${user.id}`,
    action: `eq.${action}`,
    period_start: `eq.${periodStart}`,
    limit: "1000",
  });
  let rows = [];
  try {
    rows = await supabaseAdminJson(`usage_events?${params}`, { userToken: user.token, supabaseHints: user.supabaseHints });
  } catch {
    rows = [];
  }
  const used = Array.isArray(rows) ? rows.length : 0;
  const limit = isAdmin ? null : Number(access.daily_ai_limit ?? access.weekly_ai_limit ?? 10);
  return {
    action,
    period_kind: "day",
    period_start: periodStart,
    used,
    limit,
    remaining: limit == null ? null : Math.max(limit - used, 0),
    is_admin: Boolean(isAdmin),
  };
};

const ensureUsageCapacity = async (auth, action = "ai_analysis") => {
  const state = await usageState(auth, action);
  if (!state.is_admin && state.remaining <= 0) {
    throw httpError(429, `Daily AI analysis limit reached (${state.limit}/day)`);
  }
  return state;
};

const recordUsage = async (auth, action = "ai_analysis", metadata = {}) => {
  if (!auth.isAdmin) {
    try {
      await supabaseAdminJson("usage_events", {
        method: "POST",
        headers: { prefer: "return=minimal" },
        userToken: auth.user.token,
        supabaseHints: auth.user.supabaseHints,
        body: JSON.stringify({
          user_id: auth.user.id,
          email: auth.user.email,
          action,
          period_start: dayStartDate(),
          metadata,
        }),
      });
    } catch {
      // Usage tracking should never block a finished AI analysis.
    }
  }
  return usageState(auth, action);
};

const accountStatus = async (request) => {
  const auth = await requireBetaUser(request);
  return {
    user: auth.user,
    access: {
      email: auth.access.email,
      role: auth.access.role,
      status: auth.access.status,
      daily_ai_limit: Number(auth.access.daily_ai_limit ?? auth.access.weekly_ai_limit ?? 10),
      can_post_social: Boolean(auth.access.can_post_social),
      can_add_education: Boolean(auth.access.can_add_education),
      can_use_ai_analysis: featureEnabled(auth, "ai_analysis"),
      can_use_pbm_brain: featureEnabled(auth, "pbm_brain"),
    },
    is_admin: auth.isAdmin,
    usage: {
      ai_analysis: await usageState(auth, "ai_analysis"),
    },
  };
};

const supabaseAuthAdminUsers = async (supabaseHints) => {
  const { url, serviceKey } = supabaseConfig(supabaseHints);
  if (!serviceKey) throw httpError(500, "SUPABASE_SERVICE_ROLE_KEY is required for admin user management");
  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok) throw httpError(response.status, body?.message || "Supabase users could not be loaded");
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.users)) return body.users;
  if (Array.isArray(body?.data?.users)) return body.data.users;
  return [];
};

const adminUsers = async (request) => {
  const auth = await requireBetaUser(request);
  if (!auth.isAdmin) throw httpError(403, "Only PBM admin can manage users");

  if (request.method === "GET") {
    try {
      await supabaseAdminJson("rpc/sync_auth_users_to_beta_access", {
        method: "POST",
        service: true,
        supabaseHints: auth.user.supabaseHints,
        body: "{}",
      });
    } catch {
      // Older schemas may not have the sync RPC yet. Auth Admin remains the fallback.
    }
    const accessRows = await supabaseAdminJson(
      "beta_access?select=email,role,status,daily_ai_limit,can_use_ai_analysis,can_use_pbm_brain,created_at,updated_at&order=created_at.desc&limit=1000",
      { service: true, supabaseHints: auth.user.supabaseHints },
    );
    let authUsers = [];
    try {
      authUsers = await supabaseAuthAdminUsers(auth.user.supabaseHints);
    } catch {
      authUsers = [];
    }
    const accessByEmail = new Map(
      (Array.isArray(accessRows) ? accessRows : []).map((item) => [
        String(item.email || "").trim().toLowerCase(),
        item,
      ]),
    );
    const authByEmail = new Map(
      authUsers.map((item) => [String(item.email || "").trim().toLowerCase(), item]),
    );
    const emails = new Set([...accessByEmail.keys(), ...authByEmail.keys()]);
    return [...emails].filter(Boolean).map((email) => {
      const row = accessByEmail.get(email) || defaultUserAccess(email);
      const authUser = authByEmail.get(email);
      const isAdmin = ADMIN_EMAILS.has(email) && row.role === "admin";
      return {
        email,
        role: isAdmin ? "admin" : "user",
        status: row.status || "active",
        daily_ai_limit: Number(row.daily_ai_limit ?? 10),
        can_use_ai_analysis: isAdmin || row.can_use_ai_analysis !== false,
        can_use_pbm_brain: isAdmin || row.can_use_pbm_brain === true,
        user_id: authUser?.id || null,
        registered_at: authUser?.created_at || row.created_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    });
  }

  if (request.method === "PATCH") {
    const payload = await requestJson(request);
    const email = String(payload.email || "").trim().toLowerCase();
    if (!email) throw httpError(400, "User email is required");
    if (ADMIN_EMAILS.has(email)) throw httpError(400, "PBM admin access cannot be disabled");

    const update = {
      can_use_ai_analysis: payload.can_use_ai_analysis !== false,
      can_use_pbm_brain: payload.can_use_pbm_brain === true,
      updated_at: new Date().toISOString(),
    };
    const rows = await supabaseAdminJson("beta_access?on_conflict=email", {
      method: "POST",
      service: true,
      supabaseHints: auth.user.supabaseHints,
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ email, ...update }),
    });
    if (!Array.isArray(rows) || !rows[0]) throw httpError(500, "User access could not be saved");
    return {
      email,
      can_use_ai_analysis: rows[0].can_use_ai_analysis !== false,
      can_use_pbm_brain: rows[0].can_use_pbm_brain === true,
    };
  }

  throw httpError(405, "Method not allowed");
};

const htmlEscape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fetchNotificationRecipients = async (senderEmail) => {
  if (!hasSupabaseServiceKey()) return [];
  const params = new URLSearchParams({
    select: "email",
    status: "eq.active",
    limit: "200",
  });
  const rows = await supabaseAdminJson(`beta_access?${params}`, { service: true });
  const emails = (Array.isArray(rows) ? rows : [])
    .map((row) => String(row.email || "").trim().toLowerCase())
    .filter((email) => email && email !== senderEmail);
  if (!emails.length) return [];

  let preferences = [];
  try {
    preferences = await supabaseAdminJson(
      "notification_preferences?select=recipient_email,email_enabled,web_push_enabled,native_push_enabled&limit=500",
      { service: true },
    );
  } catch {
    preferences = [];
  }
  const byEmail = new Map(
    (Array.isArray(preferences) ? preferences : []).map((row) => [
      String(row.recipient_email || "").trim().toLowerCase(),
      row,
    ]),
  );
  return emails.map((email) => ({
    email,
    email_enabled: byEmail.get(email)?.email_enabled !== false,
    web_push_enabled: byEmail.get(email)?.web_push_enabled === true,
    native_push_enabled: byEmail.get(email)?.native_push_enabled !== false,
  }));
};

const sendSocialEmail = async (to, post, senderEmail) => {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) return { skipped: true, reason: "RESEND_API_KEY is not configured" };
  const from = getEnv("PBM_EMAIL_FROM") || "PBM <onboarding@resend.dev>";
  const siteUrl = (getEnv("PBM_SITE_URL") || getEnv("URL") || "").replace(/\/+$/, "");
  const channelUrl = siteUrl ? `${siteUrl}/social` : "";
  const symbol = htmlEscape(post.symbol || "PBM");
  const timeframe = htmlEscape(post.timeframe || "1h");
  const bias = htmlEscape(post.bias || "neutral");
  const score = post.confidence == null || post.confidence === "" ? "" : ` / Score: ${htmlEscape(post.confidence)}`;
  const summary = htmlEscape(post.summary || "A new PBM Market Drop is live.");
  const imageUrl = String(post.image_url || "");
  const safeImageUrl = /^https?:\/\//i.test(imageUrl) ? htmlEscape(imageUrl) : "";

  const html = [
    `<div style="font-family:Arial,sans-serif;background:#fafafa;padding:28px;color:#18181b">`,
    `<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden">`,
    `<div style="padding:18px 20px;border-bottom:1px solid #f4f4f5">`,
    `<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#71717a;font-weight:700">PBM Market Drop</div>`,
    `<h1 style="font-size:24px;line-height:1.2;margin:6px 0 0;color:#09090b">${symbol} market update</h1>`,
    `</div>`,
    safeImageUrl ? `<img src="${safeImageUrl}" alt="${symbol}" style="display:block;width:100%;height:auto;border-bottom:1px solid #f4f4f5" />` : "",
    `<div style="padding:20px">`,
    `<div style="font-size:14px;color:#52525b;margin-bottom:12px">${timeframe} / ${bias}${score}</div>`,
    `<p style="font-size:15px;line-height:1.6;color:#27272a;margin:0 0 18px">${summary}</p>`,
    channelUrl ? `<a href="${htmlEscape(channelUrl)}" style="display:inline-block;background:#09090b;color:#fff;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:14px;font-weight:600">Open PBM Social</a>` : "",
    `<div style="font-size:12px;color:#a1a1aa;margin-top:18px">Shared by ${htmlEscape(senderEmail)}</div>`,
    `</div></div></div>`,
  ].join("");

  const response = await fetch(RESEND, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `PBM Market Drop: ${post.symbol || "New market update"}`,
      html,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, email: to, detail: body?.message || body?.error || JSON.stringify(body) };
  }
  return { ok: true, email: to, id: body?.id };
};

const createWebNotifications = async (recipients, post, senderEmail) => {
  if (!hasSupabaseServiceKey() || !recipients.length) return { created: 0, failed: false };
  const symbol = String(post.symbol || "PBM").trim().toUpperCase();
  const timeframe = String(post.timeframe || "1h").trim();
  const bias = String(post.bias || "neutral").trim();
  const body = String(post.summary || `${timeframe} ${bias} market update`).trim().slice(0, 500);
  const rows = recipients.map((recipient) => ({
    recipient_email: recipient.email,
    sender_email: senderEmail,
    type: "market_drop",
    title: `PBM Market Drop: ${symbol}`,
    body,
    href: "/social",
    payload: {
      post_id: post.post_id || post.id || null,
      symbol,
      timeframe,
      bias,
      confidence: post.confidence ?? null,
      image_url: post.image_url || "",
    },
  }));
  try {
    const created = await supabaseAdminJson("notifications", {
      method: "POST",
      service: true,
      headers: { prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    return { created: Array.isArray(created) ? created.length : rows.length, failed: false };
  } catch (error) {
    return { created: 0, failed: true, detail: error?.message || "Web notification insert failed" };
  }
};

const base64Url = (value) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const firebaseServiceAccount = () => {
  const raw = getEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(atob(raw));
    } catch {
      throw httpError(500, "FIREBASE_SERVICE_ACCOUNT_JSON is invalid");
    }
  }
};

const firebaseAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  if (firebaseAccessTokenCache?.expiresAt > now + 60) return firebaseAccessTokenCache.value;
  const account = firebaseServiceAccount();
  if (!account?.client_email || !account?.private_key) {
    throw httpError(500, "Firebase service account is not configured");
  }
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const pem = account.private_key
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64Url(signature)}`;
  const token = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  firebaseAccessTokenCache = {
    value: token.access_token,
    expiresAt: now + Number(token.expires_in || 3600),
  };
  return token.access_token;
};

const fetchPushTokens = async (recipients) => {
  if (!hasSupabaseServiceKey() || !recipients.length) return [];
  const rows = await supabaseAdminJson("push_tokens?select=id,token,recipient_email,platform&active=eq.true&limit=500", {
    service: true,
  });
  const allowed = new Map(recipients.map((recipient) => [recipient.email, recipient]));
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const preference = allowed.get(String(row.recipient_email || "").toLowerCase());
    if (!preference) return false;
    if (row.platform === "web") return preference.web_push_enabled;
    return preference.native_push_enabled;
  });
};

const sendFirebasePush = async (device, post) => {
  const account = firebaseServiceAccount();
  const projectId = getEnv("FIREBASE_PROJECT_ID") || account?.project_id;
  if (!projectId) throw httpError(500, "FIREBASE_PROJECT_ID is not configured");
  const token = await firebaseAccessToken();
  const symbol = String(post.symbol || "PBM").trim().toUpperCase();
  const siteUrl = (getEnv("PBM_SITE_URL") || getEnv("URL") || "").replace(/\/+$/, "");
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: device.token,
        notification: {
          title: `PBM Market Drop: ${symbol}`,
          body: String(post.summary || `${post.timeframe || "1h"} ${post.bias || "neutral"} market update`).slice(0, 180),
          ...(post.image_url ? { image: post.image_url } : {}),
        },
        data: {
          href: "/social",
          type: "market_drop",
          post_id: String(post.post_id || post.id || ""),
          symbol,
          timeframe: String(post.timeframe || "1h"),
          bias: String(post.bias || "neutral"),
        },
        android: {
          priority: "high",
          notification: {
            channel_id: "pbm_social",
            icon: "ic_stat_pbm",
            color: "#09090B",
          },
        },
        webpush: {
          notification: {
            icon: "/pbm-icon-192.png",
            badge: "/pbm-icon-192.png",
          },
          ...(siteUrl ? { fcm_options: { link: `${siteUrl}/social` } } : {}),
        },
      },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw httpError(response.status, text || "Firebase push failed");
  }
  return { ok: true, token: device.token };
};

const sendSocialPush = async (recipients, post) => {
  if (!getEnv("FIREBASE_SERVICE_ACCOUNT_JSON")) {
    return { skipped: true, reason: "Firebase is not configured", devices: 0, sent: 0, failed: 0 };
  }
  const devices = await fetchPushTokens(recipients);
  const results = [];
  for (const device of devices) {
    try {
      results.push(await sendFirebasePush(device, post));
    } catch (error) {
      results.push({ ok: false, detail: error?.message || "Firebase push failed" });
    }
  }
  return {
    skipped: false,
    devices: devices.length,
    sent: results.filter((item) => item.ok).length,
    failed: results.filter((item) => item.ok === false).length,
  };
};

const notifySocialPost = async (request) => {
  const auth = await requireBetaUser(request);
  if (!auth.isAdmin) {
    throw httpError(403, "This account cannot publish PBM social notifications");
  }
  const post = await requestJson(request);
  if (!post.symbol) throw httpError(400, "symbol is required");
  const recipients = await fetchNotificationRecipients(auth.user.email);
  if (!recipients.length) {
    return { skipped: true, reason: "No active beta recipients found", sent: 0, failed: 0 };
  }
  const web = await createWebNotifications(recipients, post, auth.user.email);
  const push = await sendSocialPush(recipients, post);
  if (!getEnv("RESEND_API_KEY")) {
    return {
      skipped: true,
      reason: "RESEND_API_KEY is not configured",
      recipients: recipients.length,
      web_created: web.created,
      web_failed: web.failed,
      push,
      sent: 0,
      failed: 0,
    };
  }

  const results = [];
  for (const recipient of recipients.filter((item) => item.email_enabled)) {
    results.push(await sendSocialEmail(recipient.email, post, auth.user.email));
  }
  const sent = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => item.ok === false).length;
  return {
    skipped: false,
    recipients: recipients.length,
    web_created: web.created,
    web_failed: web.failed,
    push,
    sent,
    failed,
    errors: results.filter((item) => item.ok === false).slice(0, 5),
  };
};

const registerPushToken = async (request) => {
  const auth = await requireBetaUser(request);
  const req = await requestJson(request);
  const token = String(req.token || "").trim();
  const platform = String(req.platform || "android").trim().toLowerCase();
  const active = req.active !== false;
  if (!token) throw httpError(400, "Push token is required");
  if (!["android", "ios", "web"].includes(platform)) throw httpError(400, "Invalid push platform");
  await supabaseAdminJson("push_tokens?on_conflict=token", {
    method: "POST",
    service: true,
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: auth.user.id,
      recipient_email: auth.user.email,
      token,
      platform,
      active,
      updated_at: new Date().toISOString(),
    }),
  });
  return { ok: true, platform, active };
};

const notificationPreferences = async (request) => {
  const auth = await requireBetaUser(request);
  const defaults = {
    email_enabled: true,
    web_push_enabled: false,
    native_push_enabled: true,
  };
  const params = new URLSearchParams({
    select: "email_enabled,web_push_enabled,native_push_enabled",
    user_id: `eq.${auth.user.id}`,
    limit: "1",
  });

  if (request.method === "GET") {
    const rows = await supabaseAdminJson(`notification_preferences?${params}`, {
      service: true,
      supabaseHints: auth.user.supabaseHints,
    }).catch(() => []);
    return { ...defaults, ...(Array.isArray(rows) ? rows[0] : null) };
  }

  if (request.method === "PUT") {
    const req = await requestJson(request);
    const values = {
      email_enabled: req.email_enabled !== false,
      web_push_enabled: req.web_push_enabled === true,
      native_push_enabled: req.native_push_enabled !== false,
    };
    await supabaseAdminJson("notification_preferences?on_conflict=user_id", {
      method: "POST",
      service: true,
      supabaseHints: auth.user.supabaseHints,
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: auth.user.id,
        recipient_email: auth.user.email,
        ...values,
        updated_at: new Date().toISOString(),
      }),
    });
    return values;
  }

  throw httpError(405, "Method not allowed");
};

const listNotifications = async (request) => {
  const auth = await requireBetaUser(request);
  const params = new URLSearchParams({
    select: "*",
    recipient_email: `eq.${auth.user.email}`,
    order: "created_at.desc",
    limit: "50",
  });
  const rows = await supabaseAdminJson(`notifications?${params}`, {
    service: true,
    supabaseHints: auth.user.supabaseHints,
  });
  return Array.isArray(rows) ? rows : [];
};

const markNotificationRead = async (request, id) => {
  const auth = await requireBetaUser(request);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError(400, "Invalid notification id");
  const params = new URLSearchParams({
    id: `eq.${id}`,
    recipient_email: `eq.${auth.user.email}`,
  });
  await supabaseAdminJson(`notifications?${params}`, {
    method: "PATCH",
    service: true,
    supabaseHints: auth.user.supabaseHints,
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  return { ok: true };
};

const markAllNotificationsRead = async (request) => {
  const auth = await requireBetaUser(request);
  const params = new URLSearchParams({
    recipient_email: `eq.${auth.user.email}`,
    read_at: "is.null",
  });
  await supabaseAdminJson(`notifications?${params}`, {
    method: "PATCH",
    service: true,
    supabaseHints: auth.user.supabaseHints,
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  return { ok: true };
};

const cleanYouTubeId = (value) => {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
};

const educationVideos = async (request, url, path) => {
  if (request.method === "GET") {
    const params = new URLSearchParams({
      select: "*",
      order: "created_at.desc",
      limit: "80",
    });
    return supabaseAdminJson(`education_videos?${params}`, {
      supabaseHints: supabaseHintsFromRequest(request),
    });
  }

  if (request.method === "POST") {
    const auth = await requireBetaUser(request);
    if (!auth.isAdmin) {
      throw httpError(403, "This account cannot add education videos");
    }
    const req = await requestJson(request);
    const title = String(req.title || "").trim();
    const youtubeId = cleanYouTubeId(req.youtube_id);
    if (!title || !youtubeId) throw httpError(400, "Video title and valid YouTube ID are required");
    const thumbnailUrl = req.thumbnail_url || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    await supabaseAdminJson("education_videos", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      userToken: auth.user.token,
      supabaseHints: auth.user.supabaseHints,
      body: JSON.stringify({
        user_id: auth.user.id,
        author_email: auth.user.email,
        title,
        video_url: String(req.video_url || "").trim(),
        youtube_id: youtubeId,
        thumbnail_url: thumbnailUrl,
      }),
    });
    return { ok: true };
  }

  if (request.method === "DELETE") {
    const auth = await requireBetaUser(request);
    const id = path.split("/").filter(Boolean).at(-1);
    if (!id || id === "videos") throw httpError(400, "Video id is required");
    const params = new URLSearchParams({
      id: `eq.${id}`,
      user_id: `eq.${auth.user.id}`,
    });
    await supabaseAdminJson(`education_videos?${params}`, {
      method: "DELETE",
      headers: { prefer: "return=minimal" },
      userToken: auth.user.token,
      supabaseHints: auth.user.supabaseHints,
    });
    return { ok: true };
  }

  throw httpError(405, "Method not allowed");
};

const cleanTradingViewUrl = (value) => {
  const raw = String(value || "").trim();
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return host === "tradingview.com" || host.endsWith(".tradingview.com") ? parsed.toString() : "";
  } catch {
    return "";
  }
};

const cleanHttpUrl = (value) => {
  const raw = String(value || "").trim();
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

const decodeHtmlEntities = (value) =>
  String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const resolveTradingViewImage = async (tradingviewUrl) => {
  const safeUrl = cleanTradingViewUrl(tradingviewUrl);
  if (!safeUrl) return "";
  try {
    const response = await fetch(safeUrl, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PBM/1.0; +https://pbmdesk.pbmsolutions.workers.dev)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return "";
    const html = (await response.text()).slice(0, 750000);
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern)?.[1];
      const imageUrl = cleanHttpUrl(decodeHtmlEntities(match));
      if (imageUrl) return imageUrl;
    }
  } catch {
    // TradingView may block previews for private links; the manual banner remains available.
  }
  return "";
};

const indicatorLibrary = async (request, path) => {
  if (request.method === "GET") {
    const params = new URLSearchParams({
      select: "id,user_id,title,description,tradingview_url,banner_url,created_at",
      order: "created_at.desc",
      limit: "100",
    });
    const rows = await supabaseAdminJson(`tradingview_indicators?${params}`, {
      supabaseHints: supabaseHintsFromRequest(request),
    });
    let previewBudget = 6;
    return Promise.all((Array.isArray(rows) ? rows : []).map(async (indicator) => {
      if (indicator.banner_url || previewBudget <= 0) return indicator;
      previewBudget -= 1;
      const bannerUrl = await resolveTradingViewImage(indicator.tradingview_url);
      if (!bannerUrl) return indicator;
      try {
        await supabaseAdminJson(`tradingview_indicators?id=eq.${indicator.id}`, {
          method: "PATCH",
          service: true,
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({ banner_url: bannerUrl }),
        });
      } catch {
        // Return the discovered preview even if an older database cannot persist it yet.
      }
      return { ...indicator, banner_url: bannerUrl };
    }));
  }

  if (request.method === "POST") {
    const auth = await requireBetaUser(request);
    if (!auth.isAdmin) throw httpError(403, "Only PBM admin can add indicators");
    const req = await requestJson(request);
    const title = String(req.title || "").trim().slice(0, 140);
    const description = String(req.description || "").trim().slice(0, 1000);
    const tradingviewUrl = cleanTradingViewUrl(req.tradingview_url);
    const bannerUrl = cleanHttpUrl(req.banner_url) || await resolveTradingViewImage(tradingviewUrl);
    if (!title || !tradingviewUrl) throw httpError(400, "Indicator name and a public TradingView link are required");
    const rows = await supabaseAdminJson("tradingview_indicators", {
      method: "POST",
      service: true,
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        user_id: auth.user.id,
        title,
        description,
        tradingview_url: tradingviewUrl,
        banner_url: bannerUrl,
      }),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  if (request.method === "PATCH") {
    const auth = await requireBetaUser(request);
    if (!auth.isAdmin) throw httpError(403, "Only PBM admin can edit indicators");
    const match = path.match(/^\/indicators\/([^/]+)$/);
    if (!match || !/^[0-9a-f-]{36}$/i.test(match[1])) throw httpError(400, "Invalid indicator id");
    const req = await requestJson(request);
    const title = String(req.title || "").trim().slice(0, 140);
    const description = String(req.description || "").trim().slice(0, 1000);
    const tradingviewUrl = cleanTradingViewUrl(req.tradingview_url);
    const bannerUrl = cleanHttpUrl(req.banner_url) || await resolveTradingViewImage(tradingviewUrl);
    if (!title || !tradingviewUrl) throw httpError(400, "Indicator name and a public TradingView link are required");
    const rows = await supabaseAdminJson(`tradingview_indicators?id=eq.${match[1]}`, {
      method: "PATCH",
      service: true,
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        title,
        description,
        tradingview_url: tradingviewUrl,
        banner_url: bannerUrl,
      }),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  if (request.method === "DELETE") {
    const auth = await requireBetaUser(request);
    if (!auth.isAdmin) throw httpError(403, "Only PBM admin can delete indicators");
    const match = path.match(/^\/indicators\/([^/]+)$/);
    if (!match || !/^[0-9a-f-]{36}$/i.test(match[1])) throw httpError(400, "Invalid indicator id");
    await supabaseAdminJson(`tradingview_indicators?id=eq.${match[1]}`, {
      method: "DELETE",
      service: true,
      headers: { prefer: "return=minimal" },
    });
    return { ok: true };
  }

  throw httpError(405, "Method not allowed");
};

const twelveKey = () => getEnv("TWELVE_DATA_API_KEY") || getEnv("TWELVEDATA_API_KEY");

const requireTwelveKey = () => {
  const key = twelveKey();
  if (!key) throw httpError(502, "TWELVE_DATA_API_KEY is missing from server environment variables");
  return key;
};

const QUOTES = ["USDT", "USDC", "USD", "BTC", "ETH", "BNB", "EUR", "TRY", "BRL"];

const toOkxSymbol = (symbol) => {
  const clean = String(symbol || "").toUpperCase().replace(/-/g, "");
  for (const quote of QUOTES) {
    if (clean.endsWith(quote) && clean.length > quote.length) {
      return `${clean.slice(0, -quote.length)}-${quote}`;
    }
  }
  return clean;
};

const fromOkxSymbol = (instId) => String(instId || "").replace(/-/g, "");

const isForexSymbol = (symbol) => {
  const clean = String(symbol || "").toUpperCase().replace(/[^A-Z]/g, "");
  return clean.length === 6 && FOREX_CODES.has(clean.slice(0, 3)) && FOREX_CODES.has(clean.slice(3, 6));
};

const isIndexSymbol = (symbol) => INDEX_ALIASES.has(String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));

const marketForSymbol = (symbol) => {
  if (isForexSymbol(symbol)) return "forex";
  if (isIndexSymbol(symbol)) return "index";
  return "crypto";
};

const marketList = (market) => {
  if (market === "forex") return POPULAR_FOREX;
  if (market === "index") return POPULAR_INDICES;
  return POPULAR_CRYPTO;
};

const toTwelveSymbol = (symbol) => {
  const raw = String(symbol || "").trim().toUpperCase();
  if (raw.includes("/")) return raw;
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (INDEX_ALIASES.has(compact)) return INDEX_ALIASES.get(compact);
  if (isForexSymbol(compact)) return `${compact.slice(0, 3)}/${compact.slice(3, 6)}`;

  for (const quote of ["USDT", "USDC", "USD"]) {
    if (compact.endsWith(quote) && compact.length > quote.length) {
      return `${compact.slice(0, -quote.length)}/USD`;
    }
  }
  return compact;
};

const fromTwelveSymbol = (symbol, fallback) => {
  if (fallback) return String(fallback).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
};

const YAHOO_INDEX_SYMBOLS = new Map([
  ["SPX", "^GSPC"],
  ["SP500", "^GSPC"],
  ["NDX", "^NDX"],
  ["NASDAQ100", "^NDX"],
  ["DJI", "^DJI"],
  ["DOW", "^DJI"],
  ["IXIC", "^IXIC"],
  ["RUT", "^RUT"],
  ["DAX", "^GDAXI"],
  ["FTSE", "^FTSE"],
  ["N225", "^N225"],
]);

const toYahooSymbol = (symbol) => {
  const compact = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (YAHOO_INDEX_SYMBOLS.has(compact)) return YAHOO_INDEX_SYMBOLS.get(compact);
  if (isForexSymbol(compact)) return `${compact}=X`;
  for (const quote of ["USDT", "USDC", "USD"]) {
    if (compact.endsWith(quote) && compact.length > quote.length) {
      return `${compact.slice(0, -quote.length)}-USD`;
    }
  }
  return compact;
};

const fromYahooSymbol = (symbol, fallback) => {
  if (fallback) return String(fallback).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const raw = String(symbol || "").toUpperCase();
  const indexMatch = [...YAHOO_INDEX_SYMBOLS.entries()].find(([, yahoo]) => yahoo === raw);
  if (indexMatch) return indexMatch[0];
  if (raw.endsWith("=X")) return raw.replace("=X", "");
  return raw.replace("-USD", "USDT").replace(/[^A-Z0-9]/g, "");
};

const yahooQuoteToBinanceShape = (quote, fallbackSymbol) => {
  const last = Number(quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? 0);
  const open = Number(quote.regularMarketOpen ?? quote.regularMarketPreviousClose ?? last);
  const high = Number(quote.regularMarketDayHigh ?? last);
  const low = Number(quote.regularMarketDayLow ?? last);
  const volume = Number(quote.regularMarketVolume ?? 0);
  const changePct = Number(quote.regularMarketChangePercent ?? 0);
  return {
    symbol: fromYahooSymbol(quote.symbol, fallbackSymbol),
    lastPrice: String(last),
    openPrice: String(open),
    highPrice: String(high),
    lowPrice: String(low),
    volume: String(volume),
    quoteVolume: String(volume * last || volume || 0),
    priceChangePercent: String(changePct),
  };
};

const fetchYahooQuotes = async (symbols) => {
  const yahooSymbols = symbols.map(toYahooSymbol);
  const params = new URLSearchParams({ symbols: yahooSymbols.join(",") });
  let results = [];
  try {
    const body = await fetchJson(`${YAHOO}/v7/finance/quote?${params}`);
    results = body.quoteResponse?.result || [];
  } catch {
    results = [];
  }
  const primaryRows = symbols.map((symbol) => {
    const yahoo = toYahooSymbol(symbol);
    const quote = results.find((row) => row.symbol === yahoo);
    return quote ? yahooQuoteToBinanceShape(quote, symbol) : null;
  });
  const fallbackRows = await Promise.all(
    symbols.map((symbol, index) => primaryRows[index] ? null : fetchYahooChartQuote(symbol).catch(() => null))
  );
  return symbols.map((symbol, index) => primaryRows[index] || fallbackRows[index]).filter(Boolean);
};

const fetchYahooQuote = async (symbol) => {
  const rows = await fetchYahooQuotes([symbol]);
  if (!rows.length) throw httpError(404, "Yahoo symbol not found");
  return rows[0];
};

const yahooChartQuoteToBinanceShape = (body, fallbackSymbol) => {
  const result = body.chart?.result?.[0];
  if (!result) throw httpError(502, body.chart?.error?.description || "Yahoo chart error");
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const closes = (quote.close || []).filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  const highs = (quote.high || []).filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  const lows = (quote.low || []).filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  const volumes = (quote.volume || []).filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  const last = Number(meta.regularMarketPrice ?? closes.at(-1) ?? 0);
  const open = Number(meta.chartPreviousClose ?? closes.at(-2) ?? last);
  const high = Number(meta.regularMarketDayHigh ?? highs.at(-1) ?? Math.max(last, open));
  const low = Number(meta.regularMarketDayLow ?? lows.at(-1) ?? Math.min(last, open));
  const volume = Number(meta.regularMarketVolume ?? volumes.at(-1) ?? 0);
  const changePct = open ? ((last - open) / open) * 100 : 0;
  return {
    symbol: fromYahooSymbol(meta.symbol, fallbackSymbol),
    lastPrice: String(last),
    openPrice: String(open),
    highPrice: String(high),
    lowPrice: String(low),
    volume: String(volume),
    quoteVolume: String(volume * last || volume || 0),
    priceChangePercent: String(changePct),
  };
};

const fetchYahooChartQuote = async (symbol) => {
  const params = new URLSearchParams({ range: "5d", interval: "1d" });
  const body = await fetchJson(`${YAHOO}/v8/finance/chart/${encodeURIComponent(toYahooSymbol(symbol))}?${params}`);
  return yahooChartQuoteToBinanceShape(body, symbol);
};

const yahooRangeForInterval = (interval) => {
  const tf = String(interval || "1h").toLowerCase();
  if (tf === "1m") return "7d";
  if (tf.endsWith("m")) return "60d";
  if (tf.endsWith("h")) return "730d";
  if (tf === "1w") return "5y";
  if (tf === "1mo") return "5y";
  return "5y";
};

const mapYahooInterval = (interval) => {
  const tf = String(interval || "1h").toLowerCase();
  return (
    {
      "1m": "1m",
      "3m": "5m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "1h",
      "2h": "1h",
      "4h": "1h",
      "1d": "1d",
      "1w": "1wk",
      "1mo": "1mo",
    }[tf] || "1h"
  );
};

const fetchYahooKlines = async (symbol, interval, limit) => {
  const params = new URLSearchParams({
    range: yahooRangeForInterval(interval),
    interval: mapYahooInterval(interval),
  });
  const body = await fetchJson(`${YAHOO}/v8/finance/chart/${encodeURIComponent(toYahooSymbol(symbol))}?${params}`);
  const result = body.chart?.result?.[0];
  if (!result) throw httpError(502, body.chart?.error?.description || "Yahoo chart error");
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const rows = timestamps.map((ts, idx) => {
    const open = quote.open?.[idx];
    const high = quote.high?.[idx];
    const low = quote.low?.[idx];
    const close = quote.close?.[idx];
    if ([open, high, low, close].some((value) => value == null || Number.isNaN(Number(value)))) return null;
    const t = Number(ts) * 1000;
    const volume = quote.volume?.[idx] || 0;
    return [t, String(open), String(high), String(low), String(close), String(volume), t, String(volume * close || 0), 0];
  }).filter(Boolean);
  return rows.slice(-clamp(Number(limit || 300), 1, 300));
};

const mapOkxInterval = (timeframe) => {
  const tf = String(timeframe || "1h").toLowerCase();
  return (
    {
      "1m": "1m",
      "3m": "3m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "1H",
      "2h": "2H",
      "4h": "4H",
      "6h": "6H",
      "12h": "12H",
      "1d": "1D",
      "1w": "1W",
      "1mo": "1M",
    }[tf] || "1H"
  );
};

const mapTwelveInterval = (timeframe) => {
  const tf = String(timeframe || "1h").toLowerCase();
  return (
    {
      "1m": "1min",
      "3m": "5min",
      "5m": "5min",
      "15m": "15min",
      "30m": "30min",
      "1h": "1h",
      "2h": "2h",
      "4h": "4h",
      "1d": "1day",
      "1w": "1week",
      "1mo": "1month",
    }[tf] || "1h"
  );
};

const okxTickerToBinanceShape = (ticker) => {
  const last = Number(ticker.last || 0);
  const open24 = Number(ticker.open24h || 0);
  const changePct = open24 ? ((last - open24) / open24) * 100 : 0;
  return {
    symbol: fromOkxSymbol(ticker.instId),
    lastPrice: String(last),
    openPrice: String(open24),
    highPrice: String(ticker.high24h || 0),
    lowPrice: String(ticker.low24h || 0),
    volume: String(ticker.vol24h || 0),
    quoteVolume: String(ticker.volCcy24h || 0),
    priceChangePercent: changePct.toFixed(4),
  };
};

const binanceTickerToBinanceShape = (ticker) => ({
  symbol: ticker.symbol,
  lastPrice: String(ticker.lastPrice || 0),
  openPrice: String(ticker.openPrice || 0),
  highPrice: String(ticker.highPrice || 0),
  lowPrice: String(ticker.lowPrice || 0),
  volume: String(ticker.volume || 0),
  quoteVolume: String(ticker.quoteVolume || 0),
  priceChangePercent: String(ticker.priceChangePercent || 0),
});

const twelveQuoteToBinanceShape = (quote, fallbackSymbol) => {
  if (!quote || quote.status === "error") {
    throw httpError(502, quote?.message || "Twelve Data quote error");
  }
  const close = Number(quote.close ?? quote.price ?? 0);
  const open = Number(quote.open ?? quote.previous_close ?? close);
  const volume = Number(quote.volume ?? quote.average_volume ?? 0);
  return {
    symbol: fromTwelveSymbol(quote.symbol, fallbackSymbol),
    lastPrice: String(close),
    openPrice: String(open),
    highPrice: String(quote.high ?? close),
    lowPrice: String(quote.low ?? close),
    volume: String(volume),
    quoteVolume: String(volume * close || volume || 0),
    priceChangePercent: String(quote.percent_change ?? 0),
  };
};

const fetchTwelveQuote = async (symbol) => {
  const params = new URLSearchParams({
    symbol: toTwelveSymbol(symbol),
    apikey: requireTwelveKey(),
  });
  return twelveQuoteToBinanceShape(await fetchJson(`${TWELVE}/quote?${params}`), symbol);
};

const fetchTwelvePopularTickers = async () => {
  const params = new URLSearchParams({
    symbol: POPULAR_CRYPTO.map(toTwelveSymbol).join(","),
    apikey: requireTwelveKey(),
  });
  const body = await fetchJson(`${TWELVE}/quote?${params}`);
  if (!body || body.status === "error") throw httpError(502, body?.message || "Twelve Data quote error");
  return POPULAR_CRYPTO.map((symbol) => {
    const quote = body[toTwelveSymbol(symbol)];
    return quote ? twelveQuoteToBinanceShape(quote, symbol) : null;
  }).filter(Boolean);
};

const fetchTwelveKlines = async (symbol, interval, limit) => {
  const params = new URLSearchParams({
    symbol: toTwelveSymbol(symbol),
    interval: mapTwelveInterval(interval),
    outputsize: String(clamp(Number(limit || 300), 1, 5000)),
    apikey: requireTwelveKey(),
  });
  const body = await fetchJson(`${TWELVE}/time_series?${params}`);
  if (!body || body.status === "error") throw httpError(502, body?.message || "Twelve Data time_series error");
  return [...(body.values || [])].reverse().map((row) => {
    const t = new Date(`${row.datetime}Z`).getTime();
    return [t, row.open, row.high, row.low, row.close, row.volume || "0", t, "0", 0];
  });
};

const marketKlines = async (url) => {
  const symbol = url.searchParams.get("symbol");
  if (!symbol) throw httpError(400, "symbol is required");
  const interval = url.searchParams.get("interval") || "1h";
  const limit = clamp(Number(url.searchParams.get("limit") || 300), 1, 300);
  try {
    return await fetchYahooKlines(symbol, interval, limit);
  } catch {
    // Keep exchange/API fallbacks so the chart still has a route if Yahoo is unavailable.
  }
  if (marketForSymbol(symbol) !== "crypto") {
    return fetchTwelveKlines(symbol, interval, limit);
  }
  const params = new URLSearchParams({
    instId: toOkxSymbol(symbol),
    bar: mapOkxInterval(interval),
    limit: String(limit),
  });
  try {
    const body = await fetchJson(`${OKX}/api/v5/market/candles?${params}`);
    if (String(body.code) !== "0") {
      throw httpError(400, body.msg || "OKX error");
    }
    return [...(body.data || [])].reverse().map((k) => {
      const t = Number(k[0]);
      return [t, k[1], k[2], k[3], k[4], k[5], t, k[7] || "0", 0];
    });
  } catch (okxError) {
    try {
      const binanceParams = new URLSearchParams({
        symbol: String(symbol).toUpperCase(),
        interval,
        limit: String(limit),
      });
      return await fetchJson(`${BINANCE}/api/v3/klines?${binanceParams}`);
    } catch {
      try {
        return await fetchYahooKlines(symbol, interval, limit);
      } catch {
        return fetchTwelveKlines(symbol, interval, limit);
      }
    }
  }
};

const marketTicker24h = async (url) => {
  const symbol = url.searchParams.get("symbol");
  const market = url.searchParams.get("market") || "crypto";
  if (symbol) {
    if (marketForSymbol(symbol) === "crypto") {
      try {
        const params = new URLSearchParams({ instId: toOkxSymbol(symbol) });
        const body = await fetchJson(`${OKX}/api/v5/market/ticker?${params}`);
        const data = body.data || [];
        if (!data.length) throw httpError(404, "Symbol not found");
        return okxTickerToBinanceShape(data[0]);
      } catch {
        try {
          const data = await fetchJson(`${BINANCE}/api/v3/ticker/24hr?${new URLSearchParams({ symbol: String(symbol).toUpperCase() })}`);
          return binanceTickerToBinanceShape(data);
        } catch {
          try {
            return await fetchYahooQuote(symbol);
          } catch {
            return fetchTwelveQuote(symbol);
          }
        }
      }
    }
    try {
      return await fetchYahooQuote(symbol);
    } catch {
      return fetchTwelveQuote(symbol);
    }
  }
  const preferredSymbols = marketList(market);
  if (market === "forex" || market === "index") {
    try {
      const rows = await fetchYahooQuotes(preferredSymbols);
      if (rows.length) return rows;
    } catch {
      // Keep the selected market cards populated through Twelve Data below.
    }
    const fallbackRows = await Promise.all(preferredSymbols.map((item) => fetchTwelveQuote(item).catch(() => null)));
    return fallbackRows.filter(Boolean);
  }
  try {
    const body = await fetchJson(`${OKX}/api/v5/market/tickers?instType=SPOT`);
    const rows = (body.data || [])
      .map(okxTickerToBinanceShape)
      .filter((row) => preferredSymbols.includes(row.symbol));
    if (rows.length) return rows;
    return await fetchYahooQuotes(preferredSymbols);
  } catch {
    try {
      const rows = await Promise.all(preferredSymbols.map(async (item) => {
        const data = await fetchJson(`${BINANCE}/api/v3/ticker/24hr?${new URLSearchParams({ symbol: item })}`);
        return binanceTickerToBinanceShape(data);
      }));
      return rows.filter(Boolean);
    } catch {
      try {
        return await fetchYahooQuotes(preferredSymbols);
      } catch {
        return fetchTwelvePopularTickers();
      }
    }
  }
};

const marketGlobal = async () => {
  try {
    const data = await fetchJson(`${COINPAPRIKA}/global`);
    return {
      total_market_cap: { usd: data.market_cap_usd },
      total_volume: { usd: data.volume_24h_usd },
      market_cap_percentage: {
        btc: data.bitcoin_dominance_percentage,
        eth: data.ethereum_dominance_percentage,
      },
      market_cap_change_percentage_24h_usd: data.market_cap_change_24h,
      active_cryptocurrencies: data.cryptocurrencies_number,
      markets: data.markets_number,
    };
  } catch {
    const data = await fetchJson(`${COINGECKO}/global`);
    const global = data.data || {};
    return {
      total_market_cap: { usd: global.total_market_cap?.usd },
      total_volume: { usd: global.total_volume?.usd },
      market_cap_percentage: {
        btc: global.market_cap_percentage?.btc,
        eth: global.market_cap_percentage?.eth,
      },
      market_cap_change_percentage_24h_usd: global.market_cap_change_percentage_24h_usd,
      active_cryptocurrencies: global.active_cryptocurrencies,
      markets: global.markets,
    };
  }
};

const marketSearch = async (url) => {
  const q = url.searchParams.get("q");
  if (!q) throw httpError(400, "q is required");
  try {
    return await fetchJson(`${COINGECKO}/search?${new URLSearchParams({ query: q })}`);
  } catch {
    return { coins: [] };
  }
};

const technicalScoreFromIndicators = (ind = {}, price = 0) => {
  let score = 0;
  let weight = 0;

  if (ind.rsi != null) {
    weight += 1;
    if (ind.rsi < 30) score += 80;
    else if (ind.rsi > 70) score -= 80;
    else score += (50 - Number(ind.rsi)) * -2;
  }

  if (ind.macd != null && ind.macd_signal != null) {
    weight += 1;
    score += clamp((Number(ind.macd) - Number(ind.macd_signal)) * 200, -60, 60);
  }

  if (ind.ema20 != null && ind.ema50 != null) {
    weight += 1;
    score += Number(ind.ema20) > Number(ind.ema50) ? 40 : -40;
  }

  if (ind.ema50 != null && ind.ema200 != null) {
    weight += 1;
    score += Number(ind.ema50) > Number(ind.ema200) ? 30 : -30;
  }

  if (ind.bb_upper != null && ind.bb_lower != null) {
    weight += 1;
    if (price > Number(ind.bb_upper)) score -= 30;
    else if (price < Number(ind.bb_lower)) score += 30;
  }

  if (ind.adx != null && Number(ind.adx) > 25) {
    score *= 1.1;
  }

  return weight === 0 ? 0 : clamp((score / Math.max(weight, 1)) * 1.2, -100, 100);
};

const verdictFromScore = (score) => {
  if (score >= 60) return "strong_buy";
  if (score >= 25) return "buy";
  if (score <= -60) return "strong_sell";
  if (score <= -25) return "sell";
  return "neutral";
};

const cleanSymbol = (symbol) => String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const analysisCacheKey = (req) =>
  [
    cleanSymbol(req.symbol),
    String(req.market || marketForSymbol(req.symbol) || "crypto").toLowerCase(),
    String(req.timeframe || "1h").toLowerCase(),
    String(req.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en",
  ].join(":");

const analysisCacheTtlSeconds = () => clamp(Number(getEnv("PBM_ANALYSIS_CACHE_SECONDS") || 600), 60, 3600);

const withoutRuntimeFields = (analysis = {}) => {
  const { usage: _usage, cache: _cache, ...rest } = analysis;
  return rest;
};

const readAnalysisCache = async (auth, req) => {
  const key = analysisCacheKey(req);
  const params = new URLSearchParams({
    select: "cache_key,analysis,expires_at,created_at,updated_at",
    cache_key: `eq.${key}`,
    limit: "1",
  });
  try {
    const rows = await supabaseAdminJson(`analysis_cache?${params}`, {
      service: true,
      supabaseHints: auth.user.supabaseHints,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.analysis || !row.expires_at) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;
    return row;
  } catch {
    return null;
  }
};

const writeAnalysisCache = async (auth, req, analysis) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + analysisCacheTtlSeconds() * 1000);
  const payload = {
    cache_key: analysisCacheKey(req),
    symbol: cleanSymbol(req.symbol),
    market: String(req.market || marketForSymbol(req.symbol) || "crypto").toLowerCase(),
    timeframe: String(req.timeframe || "1h").toLowerCase(),
    language: String(req.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en",
    analysis: withoutRuntimeFields(analysis),
    expires_at: expiresAt.toISOString(),
    updated_at: now.toISOString(),
  };
  try {
    await supabaseAdminJson("analysis_cache?on_conflict=cache_key", {
      method: "POST",
      service: true,
      supabaseHints: auth.user.supabaseHints,
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Cache is a cost optimization only; analysis must keep working if the table is absent.
  }
};

const languageInstruction = (language) =>
  String(language || "en").toLowerCase().startsWith("tr")
    ? "Write every user-facing string in Turkish."
    : "Write every user-facing string in English.";

const buildSystemPrompt = (market, language = "en") =>
  [
    `You are PBM AI, a senior quantitative analyst specializing in ${market} markets.`,
    "You explain technical setups crisply and never give blanket financial advice.",
    "You consider RSI, MACD, EMAs, Bollinger Bands, ADX, ATR, volume, and recent price action together.",
    languageInstruction(language),
    "You MUST respond with ONLY valid JSON, no markdown fences, no prose outside JSON.",
    'Schema strictly: {"verdict":"strong_buy|buy|neutral|sell|strong_sell","confidence":0..1,"summary":"2-3 sentence executive summary","trend":"uptrend|downtrend|sideways","short_term_outlook":"1-2 sentences about next few hours/days","medium_term_outlook":"1-2 sentences about next 1-4 weeks","patterns":[{"name":"string","direction":"bullish|bearish|neutral","confidence":0..1,"description":"short"}],"key_levels":{"support":[num,num],"resistance":[num,num]},"risk_notes":"1-2 sentences about invalidation / risk"}',
  ].join(" ");

const fetchTeachingExamples = async (symbol) => {
  const params = new URLSearchParams({
    select: "symbol,timeframe,outcome,feedback,lesson,created_at",
    order: "created_at.desc",
    limit: "12",
  });
  const cleanSymbol = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleanSymbol) params.set("symbol", `eq.${cleanSymbol}`);
  try {
    const rows = await supabaseAdminJson(`ai_teaching_feedback?${params}`);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const fetchMlMemories = async (req) => {
  const params = new URLSearchParams({
    select: "id,memory_type,title,content,weight,payload,created_at",
    order: "created_at.desc",
    limit: "30",
  });
  const symbol = cleanSymbol(req.symbol);
  const timeframe = String(req.timeframe || "").toLowerCase();
  const market = String(req.market || marketForSymbol(req.symbol) || "").toLowerCase();
  try {
    const rows = await supabaseAdminJson(`pbm_brain_memories?${params}`, {
      service: true,
      supabaseHints: req.supabaseHints,
    });
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => ["ml_model", "ml_rule", "weekly_training"].includes(row.memory_type))
      .filter((row) => {
        const payload = row.payload || {};
        const symbols = [
          payload.symbol,
          ...(Array.isArray(payload.symbols) ? payload.symbols : []),
        ].map(cleanSymbol).filter(Boolean);
        const timeframes = [
          payload.timeframe,
          ...(Array.isArray(payload.timeframes) ? payload.timeframes : []),
        ].map((item) => String(item || "").toLowerCase()).filter(Boolean);
        const markets = [
          payload.market,
          ...(Array.isArray(payload.markets) ? payload.markets : []),
        ].map((item) => String(item || "").toLowerCase()).filter(Boolean);
        const symbolMatch = symbols.length === 0 || symbols.includes(symbol);
        const timeframeMatch = timeframes.length === 0 || timeframes.includes(timeframe);
        const marketMatch = markets.length === 0 || markets.includes(market);
        return symbolMatch && timeframeMatch && marketMatch;
      })
      .slice(0, 8);
  } catch {
    return [];
  }
};

const serializeMlMemories = (memories = []) =>
  memories.map((memory) => ({
    type: memory.memory_type,
    title: memory.title,
    content: memory.content,
    weight: memory.weight,
    model_version: memory.payload?.model_version || memory.payload?.version,
    metrics: memory.payload?.metrics,
    rules: Array.isArray(memory.payload?.rules) ? memory.payload.rules.slice(0, 8) : memory.payload?.rules,
    confidence: memory.payload?.confidence,
    created_at: memory.created_at,
  }));

const buildUserPrompt = (req, techScore, teachingExamples = [], mlMemories = []) => {
  const indicators = Object.fromEntries(
    Object.entries(req.indicators || {}).filter(([, value]) => value !== null && value !== undefined)
  );
  const candles = (req.candles || []).slice(-30).map((c) =>
    [
      c.t,
      Number(c.o).toFixed(4),
      Number(c.h).toFixed(4),
      Number(c.l).toFixed(4),
      Number(c.c).toFixed(4),
      Number(c.v).toFixed(2),
    ].join(",")
  );
  return [
    `Symbol: ${req.symbol} (${req.market || "crypto"}) | timeframe: ${req.timeframe || "1h"}`,
    `Current price: ${req.current_price}`,
    `24h change: ${req.change_24h ?? null}`,
    `Heuristic composite tech score (engine pre-compute, range -100..100): ${techScore.toFixed(1)}`,
    `Indicators: ${JSON.stringify(indicators)}`,
    `Last ${candles.length} candles (t,o,h,l,c,v):`,
    candles.join("\n"),
    teachingExamples.length ? `Prior admin teaching feedback for this symbol: ${JSON.stringify(teachingExamples).slice(0, 2500)}` : "",
    mlMemories.length ? `PBM local ML memory for this symbol/timeframe: ${JSON.stringify(serializeMlMemories(mlMemories)).slice(0, 3000)}` : "",
    req.user_context ? `User note: ${req.user_context}` : "",
    "Return ONLY the JSON object.",
  ]
    .filter(Boolean)
    .join("\n");
};

const parseAiJson = (raw) => {
  const text = String(raw || "").trim();
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate || !candidate.startsWith("{")) {
    throw new Error(`No JSON object in AI response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate);
};

const callClaude = async (systemPrompt, userText) => {
  const apiKey = getEnv("ANTHROPIC_API_KEY") || getEnv("EMERGENT_LLM_KEY");
  if (!apiKey) {
    throw httpError(502, "ANTHROPIC_API_KEY or EMERGENT_LLM_KEY is missing from server environment variables");
  }

  const baseUrl = (getEnv("ANTHROPIC_BASE_URL") || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = getEnv("CLAUDE_MODEL") || DEFAULT_CLAUDE_MODEL;
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, body?.error?.message || JSON.stringify(body));
  }

  const firstText = (body.content || []).find((part) => part.type === "text")?.text;
  if (!firstText) {
    throw httpError(502, "Claude returned an empty response");
  }
  return firstText;
};

const numericLevels = (levels) =>
  (Array.isArray(levels) ? levels : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

const predictionBias = (score) => {
  if (score >= 60) return { bias: "strong_bullish", signal: "HIGH CONVICTION LONG BIAS", direction: "long" };
  if (score >= 25) return { bias: "bullish", signal: "LONG BIAS", direction: "long" };
  if (score <= -60) return { bias: "strong_bearish", signal: "HIGH CONVICTION SHORT BIAS", direction: "short" };
  if (score <= -25) return { bias: "bearish", signal: "SHORT BIAS", direction: "short" };
  return { bias: "neutral", signal: "WAIT / NO TRADE ZONE", direction: "wait" };
};

const buildPbmPrediction = ({ req, data, techScore, aiScore, combinedScore, confidence, mlMemories }) => {
  const keyLevels = typeof data.key_levels === "object" && data.key_levels ? data.key_levels : {};
  const support = numericLevels(keyLevels.support);
  const resistance = numericLevels(keyLevels.resistance);
  const bias = predictionBias(combinedScore);
  const mlBoost = Math.min((mlMemories || []).length * 2, 8);
  const confidencePct = Math.round(clamp(38 + Math.abs(combinedScore) * 0.42 + confidence * 22 + mlBoost, 35, 94));
  const targetZone = bias.direction === "long"
    ? resistance.slice(0, 2)
    : bias.direction === "short"
      ? support.slice(0, 2)
      : [...support.slice(0, 1), ...resistance.slice(0, 1)];
  const invalidation = bias.direction === "long"
    ? support[0] ?? null
    : bias.direction === "short"
      ? resistance[0] ?? null
      : null;
  const latestMemory = (mlMemories || [])[0];
  const modelVersion = latestMemory?.payload?.model_version || latestMemory?.payload?.version || null;
  const isTurkish = String(req.language || "en").toLowerCase().startsWith("tr");
  const statement = isTurkish
    ? `${bias.signal} baskın senaryo olarak öne çıkıyor; bu kesin sinyal değil, teknik motor + Claude analizi + PBM öğrenme hafızasının ortak bias çıktısıdır.`
    : `${bias.signal} is the dominant scenario; this is not a guaranteed signal, it is the combined bias from the technical engine, Claude analysis, and PBM learning memory.`;
  const learningNote = latestMemory
    ? (isTurkish
        ? `ML hafızası aktif: ${latestMemory.title || modelVersion || "latest local model"} bu analize dahil edildi.`
        : `ML memory active: ${latestMemory.title || modelVersion || "latest local model"} was included in this analysis.`)
    : (isTurkish
        ? "ML hafızası henüz örnek topluyor; haftalık feedback exportları geldikçe bu bias daha kişisel hale gelecek."
        : "ML memory is still collecting examples; weekly feedback exports will make this bias more personalized.");

  return {
    bias: bias.bias,
    signal: bias.signal,
    direction: bias.direction,
    confidence_pct: confidencePct,
    score: Number(combinedScore.toFixed(2)),
    tech_score: Number(techScore.toFixed(2)),
    ai_score: Number(aiScore.toFixed(2)),
    target_zone: targetZone,
    invalidation,
    timeframe: req.timeframe || "1h",
    statement,
    learning_note: learningNote,
    ml_memory_count: (mlMemories || []).length,
    ml_model_version: modelVersion,
    source_stack: ["technical_engine", "claude_sonnet", "ai_teaching_feedback", "pbm_local_ml_memory"],
  };
};

const analyze = async (request) => {
  const auth = await requireBetaUser(request);
  requireFeature(auth, "ai_analysis", "AI Analysis is not enabled for this account");
  const req = await requestJson(request);
  if (!req.symbol) throw httpError(400, "symbol is required");
  if (req.current_price == null) throw httpError(400, "current_price is required");

  if (!req.bypass_cache) {
    const cached = await readAnalysisCache(auth, req);
    if (cached?.analysis) {
      return {
        ...cached.analysis,
        cache: { hit: true, cache_key: cached.cache_key, expires_at: cached.expires_at },
        pbm_prediction: cached.analysis.pbm_prediction
          ? { ...cached.analysis.pbm_prediction, cache_hit: true }
          : undefined,
        usage: await usageState(auth, "ai_analysis"),
      };
    }
  }

  await ensureUsageCapacity(auth, "ai_analysis");

  const techScore = technicalScoreFromIndicators(req.indicators, Number(req.current_price));
  const teachingExamples = await fetchTeachingExamples(req.symbol);
  const mlMemories = await fetchMlMemories({ ...req, supabaseHints: auth.user.supabaseHints });
  const raw = await callClaude(
    buildSystemPrompt(req.market || "crypto", req.language || "en"),
    buildUserPrompt(req, techScore, teachingExamples, mlMemories)
  );
  const data = parseAiJson(raw);

  const verdictMap = {
    strong_buy: 80,
    buy: 40,
    neutral: 0,
    sell: -40,
    strong_sell: -80,
  };
  const aiVerdict = data.verdict || "neutral";
  const confidence = Number(data.confidence ?? 0.65);
  const aiScore = (verdictMap[aiVerdict] ?? 0) * confidence;
  const combinedScore = techScore * 0.45 + aiScore * 0.55;

  const keyLevels = typeof data.key_levels === "object" && data.key_levels ? data.key_levels : {};
  keyLevels.support ||= [];
  keyLevels.resistance ||= [];

  const analysis = {
    id: crypto.randomUUID(),
    symbol: req.symbol,
    verdict: verdictFromScore(combinedScore),
    confidence,
    summary: String(data.summary || "").slice(0, 600),
    trend: data.trend || "sideways",
    short_term_outlook: String(data.short_term_outlook || "").slice(0, 400),
    medium_term_outlook: String(data.medium_term_outlook || "").slice(0, 400),
    patterns: (data.patterns || []).slice(0, 6).map((pattern) => ({
      name: String(pattern.name || "pattern").slice(0, 80),
      direction: pattern.direction || "neutral",
      confidence: Number(pattern.confidence ?? 0.5),
      description: String(pattern.description || "").slice(0, 300),
    })),
    key_levels: keyLevels,
    risk_notes: String(data.risk_notes || "").slice(0, 400),
    technical_score: Number(techScore.toFixed(2)),
    ai_score: Number(aiScore.toFixed(2)),
    combined_score: Number(combinedScore.toFixed(2)),
    pbm_prediction: buildPbmPrediction({ req, data, techScore, aiScore, combinedScore, confidence, mlMemories }),
    training_snapshot: {
      schema_version: "pbm-training-snapshot-v1",
      symbol: cleanSymbol(req.symbol),
      market: req.market || marketForSymbol(req.symbol) || "crypto",
      timeframe: req.timeframe || "1h",
      current_price: Number(req.current_price),
      change_24h: req.change_24h ?? null,
      indicators: req.indicators || {},
      candles: (req.candles || []).slice(-80),
      technical_score: Number(techScore.toFixed(2)),
      ai_score: Number(aiScore.toFixed(2)),
      combined_score: Number(combinedScore.toFixed(2)),
      generated_at: new Date().toISOString(),
    },
    cache: { hit: false, ttl_seconds: analysisCacheTtlSeconds() },
    usage: await recordUsage(auth, "ai_analysis", { feature: "asset_analysis", symbol: req.symbol, timeframe: req.timeframe }),
  };
  await writeAnalysisCache(auth, req, analysis);
  return analysis;
};

const chat = async (request) => {
  const auth = await requireBetaUser(request);
  requireFeature(auth, "ai_analysis", "AI Analysis is not enabled for this account");
  await ensureUsageCapacity(auth, "ai_analysis");
  const req = await requestJson(request);
  if (!req.session_id) throw httpError(400, "session_id is required");
  if (!req.message) throw httpError(400, "message is required");
  const language = req.language || "en";
  const system = [
    "You are PBM AI, a concise quantitative trading copilot.",
    languageInstruction(language),
    "Keep replies under 200 words unless a chart or list helps.",
    "Never fabricate exact prices you don't have; use the provided context.",
    "Always remind that this is not financial advice when giving directional opinions.",
  ].join(" ");
  const context = req.context ? `\nContext: ${JSON.stringify(req.context).slice(0, 1500)}` : "";
  const symbol = req.symbol ? `\nSymbol: ${req.symbol}` : "";
  const reply = await callClaude(system, `${req.message}${symbol}${context}`);
  return {
    session_id: req.session_id,
    reply: reply.trim(),
    usage: await recordUsage(auth, "ai_analysis", { feature: "chat", symbol: req.symbol || null }),
  };
};

const routeBrainExpert = (question = "", profile = {}) => {
  const text = `${question} ${JSON.stringify(profile).slice(0, 800)}`.toLowerCase();
  if (/(drawdown|risk|rr|stop|sizing)/.test(text)) {
    return { router_topic: "risk", expert: "Risk / Drawdown Expert" };
  }
  if (/(journal|mistake|psychology|discipline|fomo|revenge|habit)/.test(text)) {
    return { router_topic: "journal", expert: "Journal Coach" };
  }
  if (/(education|lesson|video|learn|course|training)/.test(text)) {
    return { router_topic: "education", expert: "Education Expert" };
  }
  if (/(social|position|screenshot|setup|entry|exit|trade)/.test(text)) {
    return { router_topic: "setup", expert: "Setup Quality Expert" };
  }
  if (/(forex|eurusd|gbpusd|usdjpy|indices|spx|nasdaq|crypto|btc|eth)/.test(text)) {
    return { router_topic: "market", expert: "Market Regime Expert" };
  }
  return { router_topic: "router", expert: "PBM Router Head" };
};

const summarizeBrainData = (req) => {
  const journal = Array.isArray(req.journal) ? req.journal : [];
  const analyses = Array.isArray(req.analyses) ? req.analyses : [];
  const socialPosts = Array.isArray(req.social_posts) ? req.social_posts : [];
  const memories = Array.isArray(req.memories) ? req.memories : [];
  const pnlRows = journal
    .map((entry) => Number(entry.pnl))
    .filter((value) => Number.isFinite(value));
  const wins = pnlRows.filter((value) => value > 0).length;
  const totalPnl = pnlRows.reduce((sum, value) => sum + value, 0);
  const losses = pnlRows.filter((value) => value < 0);
  const symbols = [...new Set(journal.map((entry) => entry.symbol).filter(Boolean))].slice(0, 8);
  return {
    journal_count: journal.length,
    analysis_count: analyses.length,
    social_post_count: socialPosts.length,
    memory_count: memories.length,
    total_pnl: Number(totalPnl.toFixed(2)),
    win_rate: pnlRows.length ? Number(((wins / pnlRows.length) * 100).toFixed(1)) : null,
    average_pnl: pnlRows.length ? Number((totalPnl / pnlRows.length).toFixed(2)) : null,
    loss_count: losses.length,
    symbols,
  };
};

const scoreBrainProfile = (profile) => {
  let score = 50;
  if (profile.journal_count >= 20) score += 12;
  else if (profile.journal_count >= 5) score += 6;
  else score -= 8;
  if (profile.win_rate != null) score += clamp((profile.win_rate - 50) * 0.45, -15, 15);
  if (profile.total_pnl > 0) score += 8;
  if (profile.total_pnl < 0) score -= 8;
  if (profile.memory_count > 0) score += 4;
  if (profile.social_post_count > 0) score += 3;
  return Math.round(clamp(score, 0, 100));
};

const brainFallback = (req, profile, route) => {
  const setupScore = scoreBrainProfile(profile);
  const recommendations = [];
  const risks = [];

  if (profile.journal_count < 10) {
    recommendations.push("Feed PBM Brain with at least 10-20 journal entries before trusting pattern-level conclusions.");
  } else {
    recommendations.push("Segment your next review by symbol and session so the strongest and weakest setups become visible.");
  }
  if (profile.win_rate != null && profile.win_rate < 45) {
    recommendations.push("Tag losing trades by mistake type: early entry, no confirmation, stop too tight, or news volatility.");
    risks.push("Recent journal data suggests execution quality is not stable enough for aggressive sizing.");
  }
  if (profile.total_pnl < 0) {
    recommendations.push("Run a drawdown review before adding new risk; focus on loss clusters, not single trades.");
  }
  if (profile.social_post_count > 0) {
    recommendations.push("Use your posted position screenshots as setup examples and attach outcome labels after the trade closes.");
  }
  if (!recommendations.length) {
    recommendations.push("Keep adding structured journal records; PBM Brain will become more personal as the memory grows.");
  }
  if (profile.journal_count < 5) risks.push("Low sample size: this is a coaching read, not a statistical model yet.");
  if (!risks.length) risks.push("Model risk remains high because live market regimes can change faster than the stored sample.");

  return {
    router_topic: route.router_topic,
    expert: route.expert,
    setup_score: setupScore,
    confidence: profile.journal_count >= 20 ? 0.72 : profile.journal_count >= 5 ? 0.58 : 0.42,
    summary: `${route.expert} reviewed ${profile.journal_count} journal entries, ${profile.analysis_count} AI analyses, and ${profile.social_post_count} position posts. The current PBM Brain score is ${setupScore}/100; treat it as a learning score until more labeled outcomes are stored.`,
    recommendations: recommendations.slice(0, 5),
    risks: risks.slice(0, 4),
    next_memory: "Add entry/exit, timeframe, setup label, and final outcome to each posted position so PBM Brain can learn your real edge.",
  };
};

const brainPrompt = (req, profile, route) => [
  "You are PBM Brain: an app-level Mixture-of-Experts router for a trader workspace.",
  `Router selected: ${route.expert} (${route.router_topic}).`,
  "Use the user's journal, social position posts, analysis history, and memories.",
  "Do not claim to be a trained LoRA/CNN model yet; this is the first learning loop.",
  "Give practical coaching and data-quality next steps. No financial advice.",
  'Return ONLY JSON with schema: {"router_topic":"string","expert":"string","setup_score":0..100,"confidence":0..1,"summary":"short","recommendations":["string"],"risks":["string"],"next_memory":"string"}',
  `Question: ${req.question || "Review my trading profile."}`,
  `Profile: ${JSON.stringify(profile)}`,
  `Recent journal: ${JSON.stringify((req.journal || []).slice(0, 20)).slice(0, 5000)}`,
  `Recent analyses: ${JSON.stringify((req.analyses || []).slice(0, 12)).slice(0, 3000)}`,
  `Recent social posts: ${JSON.stringify((req.social_posts || []).slice(0, 12)).slice(0, 2500)}`,
  `Memories: ${JSON.stringify((req.memories || []).slice(0, 12)).slice(0, 2500)}`,
].join("\n");

const brainAnalyze = async (request) => {
  const auth = await requireBetaUser(request);
  requireFeature(auth, "pbm_brain", "PBM Brain is not enabled for this account");
  const req = await requestJson(request);
  const profile = summarizeBrainData(req);
  const route = routeBrainExpert(req.question, profile);
  const apiKey = getEnv("ANTHROPIC_API_KEY") || getEnv("EMERGENT_LLM_KEY");
  let data = brainFallback(req, profile, route);

  if (apiKey) {
    try {
      const raw = await callClaude("You are PBM Brain. Return only valid JSON.", brainPrompt(req, profile, route));
      const parsed = parseAiJson(raw);
      data = {
        ...data,
        ...parsed,
        router_topic: parsed.router_topic || route.router_topic,
        expert: parsed.expert || route.expert,
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 6) : data.recommendations,
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : data.risks,
        setup_score: clamp(Number(parsed.setup_score ?? data.setup_score), 0, 100),
        confidence: clamp(Number(parsed.confidence ?? data.confidence), 0, 1),
      };
    } catch {
      data = brainFallback(req, profile, route);
    }
  }

  return {
    id: crypto.randomUUID(),
    mode: apiKey ? "expert-router-ai" : "expert-router-fallback",
    profile,
    ...data,
  };
};

const parseDateParam = (value, fallback) => {
  const date = value ? new Date(value) : fallback;
  return Number.isFinite(date.getTime()) ? date : fallback;
};

const fetchRowsForPeriod = async (table, periodStart, periodEnd, select = "*") => {
  const params = new URLSearchParams({
    select,
    created_at: `gte.${periodStart.toISOString()}`,
    order: "created_at.desc",
    limit: "5000",
  });
  params.append("created_at", `lte.${periodEnd.toISOString()}`);
  try {
    const rows = await supabaseAdminJson(`${table}?${params}`, { service: true });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const fetchAnalysesByIds = async (ids = []) => {
  const cleanIds = [...new Set(ids.filter(Boolean))].slice(0, 500);
  if (!cleanIds.length) return [];
  const params = new URLSearchParams({
    select: "*",
    id: `in.(${cleanIds.join(",")})`,
    limit: String(cleanIds.length),
  });
  try {
    const rows = await supabaseAdminJson(`analysis_history?${params}`, { service: true });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const buildMlTrainingRows = (analyses, feedbackRows) => {
  const feedbackByAnalysis = new Map();
  for (const feedback of feedbackRows || []) {
    if (feedback.analysis_history_id && !feedbackByAnalysis.has(feedback.analysis_history_id)) {
      feedbackByAnalysis.set(feedback.analysis_history_id, feedback);
    }
  }
  return (analyses || []).map((analysis) => {
    const feedback = feedbackByAnalysis.get(analysis.id) || null;
    const payload = analysis.payload || {};
    return {
      row_type: "analysis_training_sample",
      analysis_id: analysis.id,
      user_id: analysis.user_id,
      symbol: cleanSymbol(analysis.symbol),
      market: analysis.market,
      timeframe: analysis.timeframe,
      verdict: analysis.verdict,
      combined_score: Number(analysis.combined_score || payload.combined_score || 0),
      ai_score: Number(payload.ai_score || 0),
      technical_score: Number(payload.technical_score || 0),
      prediction: payload.pbm_prediction || null,
      snapshot: payload.training_snapshot || null,
      summary: analysis.summary || payload.summary || "",
      key_levels: payload.key_levels || null,
      risk_notes: payload.risk_notes || "",
      feedback_outcome: feedback?.outcome || "pending",
      feedback_text: feedback?.feedback || "",
      lesson: feedback?.lesson || "",
      analyzed_at: analysis.created_at,
      feedback_at: feedback?.created_at || null,
    };
  });
};

const mlExport = async (request, url) => {
  const auth = await requireBetaUser(request);
  if (!auth.isAdmin) throw httpError(403, "Only PBM admin can export ML training data");

  const now = new Date();
  const days = clamp(Number(url.searchParams.get("days") || 7), 1, 90);
  const periodEnd = parseDateParam(url.searchParams.get("end"), now);
  const periodStart = parseDateParam(url.searchParams.get("start"), new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000));

  const [periodAnalyses, feedback, journal, socialPosts, brainRuns, brainMemories] = await Promise.all([
    fetchRowsForPeriod("analysis_history", periodStart, periodEnd),
    fetchRowsForPeriod("ai_teaching_feedback", periodStart, periodEnd),
    fetchRowsForPeriod("journal_entries", periodStart, periodEnd),
    fetchRowsForPeriod("social_posts", periodStart, periodEnd),
    fetchRowsForPeriod("pbm_brain_runs", periodStart, periodEnd),
    fetchRowsForPeriod("pbm_brain_memories", periodStart, periodEnd),
  ]);
  const periodAnalysisIds = new Set(periodAnalyses.map((row) => row.id));
  const feedbackAnalysisIds = feedback
    .map((row) => row.analysis_history_id)
    .filter((id) => id && !periodAnalysisIds.has(id));
  const linkedAnalyses = await fetchAnalysesByIds(feedbackAnalysisIds);
  const analyses = [...periodAnalyses, ...linkedAnalyses];

  const trainingRows = buildMlTrainingRows(analyses, feedback);
  const exportPayload = {
    schema_version: "pbm-ml-training-export-v1",
    generated_at: now.toISOString(),
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    counts: {
      analyses: analyses.length,
      teaching_feedback: feedback.length,
      journal_entries: journal.length,
      social_posts: socialPosts.length,
      brain_runs: brainRuns.length,
      brain_memories: brainMemories.length,
      training_rows: trainingRows.length,
    },
    training_rows: trainingRows,
    raw: {
      analyses,
      teaching_feedback: feedback,
      journal_entries: journal,
      social_posts: socialPosts,
      brain_runs: brainRuns,
      brain_memories: brainMemories,
    },
  };

  try {
    await supabaseAdminJson("pbm_brain_exports", {
      method: "POST",
      service: true,
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: auth.user.id,
        label: `ML training export ${periodStart.toISOString().slice(0, 10)} - ${periodEnd.toISOString().slice(0, 10)}`,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        record_count: trainingRows.length,
        payload: exportPayload,
      }),
    });
  } catch {
    // Export download should still succeed even if archival insert fails.
  }

  return exportPayload;
};

const mlImport = async (request) => {
  const auth = await requireBetaUser(request);
  if (!auth.isAdmin) throw httpError(403, "Only PBM admin can import ML memory");
  const req = await requestJson(request);
  const modelVersion = String(req.model_version || req.version || `local-${new Date().toISOString().slice(0, 10)}`).slice(0, 80);
  const title = String(req.title || req.label || `PBM local ML ${modelVersion}`).slice(0, 140);
  const content = String(req.summary || req.notes || "Imported local ML memory for PBM analysis bias.").slice(0, 2000);
  const payload = {
    schema_version: "pbm-ml-memory-import-v1",
    model_version: modelVersion,
    imported_at: new Date().toISOString(),
    metrics: req.metrics || {},
    rules: req.rules || [],
    memories: req.memories || [],
    symbols: req.symbols || [],
    timeframes: req.timeframes || [],
    markets: req.markets || [],
    confidence: req.confidence ?? null,
    raw: req,
  };
  const rows = await supabaseAdminJson("pbm_brain_memories", {
    method: "POST",
    service: true,
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      user_id: auth.user.id,
      memory_type: "ml_model",
      title,
      content,
      weight: Number(req.weight || 1),
      payload,
    }),
  });
  return { ok: true, memory: Array.isArray(rows) ? rows[0] : rows };
};

const runtimeName = () => getEnv("PBM_RUNTIME") || "cloudflare-workers";

const systemHealth = async (request) => {
  const auth = await requireBetaUser(request);
  if (!auth.isAdmin) throw httpError(403, "Only PBM admin can view system health");

  const checkedAt = new Date().toISOString();
  const services = {
    worker: {
      status: "operational",
      detail: runtimeName(),
    },
    supabase: {
      status: "checking",
      detail: "Checking database connection",
    },
    market_data: {
      status: "checking",
      detail: "Checking live market source",
    },
    ai_engine: {
      status: getEnv("ANTHROPIC_API_KEY") ? "configured" : "missing",
      detail: getEnv("ANTHROPIC_API_KEY") ? DEFAULT_CLAUDE_MODEL : "ANTHROPIC_API_KEY is missing",
    },
    email: {
      status: getEnv("RESEND_API_KEY") ? "configured" : "missing",
      detail: getEnv("RESEND_API_KEY") ? (getEnv("PBM_EMAIL_FROM") || "Default Resend sender") : "RESEND_API_KEY is missing",
    },
    mobile_push: {
      status: getEnv("FIREBASE_SERVICE_ACCOUNT_JSON") ? "configured" : "missing",
      detail: getEnv("FIREBASE_SERVICE_ACCOUNT_JSON") ? "Firebase service account connected" : "Firebase service account is missing",
    },
    web_push: {
      status:
        getEnv("FIREBASE_SERVICE_ACCOUNT_JSON") &&
        getEnv("REACT_APP_FIREBASE_PROJECT_ID") &&
        getEnv("REACT_APP_FIREBASE_VAPID_KEY")
          ? "configured"
          : "missing",
      detail:
        getEnv("REACT_APP_FIREBASE_PROJECT_ID") && getEnv("REACT_APP_FIREBASE_VAPID_KEY")
          ? "Firebase Web Push connected"
          : "Firebase web config or VAPID key is missing",
    },
  };

  try {
    await supabaseAdminJson("beta_access?select=email&limit=1", {
      service: true,
      supabaseHints: auth.user.supabaseHints,
    });
    services.supabase = { status: "operational", detail: "Database connection healthy" };
  } catch (error) {
    services.supabase = { status: "error", detail: String(error?.message || "Database check failed").slice(0, 180) };
  }

  try {
    const response = await fetch(`${OKX}/api/v5/market/ticker?instId=BTC-USDT`, {
      headers: { "user-agent": "PBM/1.0" },
    });
    if (!response.ok) throw new Error(`Market source returned ${response.status}`);
    services.market_data = { status: "operational", detail: "Live crypto market source healthy" };
  } catch (error) {
    services.market_data = { status: "error", detail: String(error?.message || "Market data check failed").slice(0, 180) };
  }

  const degraded = Object.values(services).some((service) => ["missing", "error"].includes(service.status));
  return {
    status: degraded ? "degraded" : "operational",
    checked_at: checkedAt,
    services,
  };
};

const handle = async (request) => {
  const url = new URL(request.url);
  const path = routePath(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method === "GET" && path === "/health") {
    return json({ status: "ok", service: "pbm-ai", runtime: runtimeName(), model: DEFAULT_CLAUDE_MODEL, version: "pbm-ml-learning-cache-20260531" }, 200, request);
  }
  if (request.method === "GET" && path === "/market/klines") return json(await marketKlines(url), 200, request);
  if (request.method === "GET" && path === "/market/ticker24h") return json(await marketTicker24h(url), 200, request);
  if (request.method === "GET" && path === "/market/global") return json(await marketGlobal(), 200, request);
  if (request.method === "GET" && path === "/market/search") return json(await marketSearch(url), 200, request);
  if (request.method === "GET" && path === "/me") return json(await accountStatus(request), 200, request);
  if (path === "/admin/users" && ["GET", "PATCH"].includes(request.method)) {
    return json(await adminUsers(request), 200, request);
  }
  if (request.method === "GET" && path === "/system/health") return json(await systemHealth(request), 200, request);
  if (path === "/education/videos" || path.startsWith("/education/videos/")) return json(await educationVideos(request, url, path), 200, request);
  if (path === "/indicators" || path.startsWith("/indicators/")) return json(await indicatorLibrary(request, path), 200, request);
  if (request.method === "POST" && path === "/analyze") return json(await analyze(request), 200, request);
  if (request.method === "POST" && path === "/chat") return json(await chat(request), 200, request);
  if (request.method === "POST" && path === "/brain/analyze") return json(await brainAnalyze(request), 200, request);
  if (request.method === "GET" && path === "/ml/export") return json(await mlExport(request, url), 200, request);
  if (request.method === "POST" && path === "/ml/import") return json(await mlImport(request), 200, request);
  if (request.method === "POST" && path === "/social/notify") return json(await notifySocialPost(request), 200, request);
  if (request.method === "POST" && path === "/push/register") return json(await registerPushToken(request), 200, request);
  if (path === "/notification-preferences" && ["GET", "PUT"].includes(request.method)) {
    return json(await notificationPreferences(request), 200, request);
  }
  if (request.method === "GET" && path === "/notifications") return json(await listNotifications(request), 200, request);
  if (request.method === "POST" && path === "/notifications/read-all") return json(await markAllNotificationsRead(request), 200, request);
  const notificationReadMatch = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (request.method === "PATCH" && notificationReadMatch) {
    return json(await markNotificationRead(request, notificationReadMatch[1]), 200, request);
  }

  return json({ detail: "Not found" }, 404, request);
};

export { handle as handleRequest };
