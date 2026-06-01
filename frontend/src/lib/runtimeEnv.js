const buildEnv = {
  REACT_APP_API_BASE: process.env.REACT_APP_API_BASE || "",
  REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL || "",
  REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL || "",
  REACT_APP_SUPABASE_ANON_KEY: process.env.REACT_APP_SUPABASE_ANON_KEY || "",
};

export function getRuntimeEnv(name, fallback = "") {
  const runtimeEnv =
    typeof window !== "undefined" && window.__PBM_ENV__
      ? window.__PBM_ENV__
      : {};
  return buildEnv[name] || runtimeEnv[name] || fallback;
}
