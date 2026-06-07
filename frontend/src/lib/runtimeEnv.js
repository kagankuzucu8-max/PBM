const buildEnv = {
  REACT_APP_API_BASE: process.env.REACT_APP_API_BASE || "",
  REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL || "",
  REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL || "",
  REACT_APP_SUPABASE_ANON_KEY: process.env.REACT_APP_SUPABASE_ANON_KEY || "",
  REACT_APP_FIREBASE_API_KEY: process.env.REACT_APP_FIREBASE_API_KEY || "",
  REACT_APP_FIREBASE_AUTH_DOMAIN: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  REACT_APP_FIREBASE_PROJECT_ID: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  REACT_APP_FIREBASE_STORAGE_BUCKET: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  REACT_APP_FIREBASE_APP_ID: process.env.REACT_APP_FIREBASE_APP_ID || "",
  REACT_APP_FIREBASE_VAPID_KEY: process.env.REACT_APP_FIREBASE_VAPID_KEY || "",
};

export function getRuntimeEnv(name, fallback = "") {
  const runtimeEnv =
    typeof window !== "undefined" && window.__PBM_ENV__
      ? window.__PBM_ENV__
      : {};
  return buildEnv[name] || runtimeEnv[name] || fallback;
}
