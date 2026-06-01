import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SUPABASE_CONFIGURED } from "@/lib/supabase";

export default function AuthPage() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        navigate("/");
      } else {
        await signUp(email, password);
        setInfo("Check your email to confirm — or sign in directly if confirmations are disabled in Supabase.");
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFAFA]">
      {/* Left: brand + visual */}
      <div className="hidden lg:flex relative overflow-hidden bg-zinc-950 text-white p-12 flex-col justify-between">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "url(https://images.pexels.com/photos/6203470/pexels-photo-6203470.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1200)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-950/85 to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-white flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-zinc-950" strokeWidth={2} />
            </div>
            <div>
              <div className="font-heading text-lg font-extrabold tracking-tight leading-none">PBM</div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-zinc-400 mt-1">AI Trading Terminal</div>
            </div>
          </div>
        </div>
        <div className="relative max-w-md">
          <div className="text-4xl font-heading font-extrabold tracking-tight leading-[1.1]">
            Smarter market reads,<br />
            <span className="text-emerald-400">deeper</span> conviction.
          </div>
          <p className="mt-6 text-zinc-300 leading-relaxed text-sm">
            Live charts, classical indicators, and a Claude Sonnet 4.5 analyst that
            tells you what the setup actually means — in one focused workspace.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { k: "RSI · MACD", v: "Indicators" },
              { k: "Patterns", v: "AI engine" },
              { k: "Watchlists", v: "& alerts" },
            ].map((f) => (
              <div key={f.k} className="border border-white/10 rounded-md px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-400">{f.v}</div>
                <div className="text-sm font-semibold mt-0.5">{f.k}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-[11px] tracking-[0.1em] uppercase text-zinc-500">
          Not financial advice · Use at your own risk
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-md bg-zinc-950 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="font-heading text-lg font-extrabold tracking-tight">PBM</div>
          </div>
          <div className="mb-8">
            <h1 className="text-3xl font-heading font-extrabold tracking-tight text-zinc-950">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-zinc-500 mt-2">
              {mode === "signin" ? "Sign in to continue your analysis." : "Start analyzing markets in seconds."}
            </p>
          </div>

          {!SUPABASE_CONFIGURED && (
            <div className="mb-5 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>Supabase env vars not set. Sign-in will not work until <code>REACT_APP_SUPABASE_URL</code> and <code>REACT_APP_SUPABASE_ANON_KEY</code> are configured.</div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4" data-testid="auth-form">
            <div>
              <label className="text-[11px] tracking-[0.08em] uppercase font-semibold text-zinc-500 block mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="auth-email-input"
                className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
                placeholder="you@desk.com"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-[0.08em] uppercase font-semibold text-zinc-500 block mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="auth-password-input"
                className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2" data-testid="auth-error">
                {error}
              </div>
            )}
            {info && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2" data-testid="auth-info">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="auth-submit-btn"
              className="w-full flex items-center justify-center gap-2 bg-zinc-950 text-white py-2.5 rounded-md font-medium hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              {loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-500">
            {mode === "signin" ? "New to PBM?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
              data-testid="auth-mode-toggle"
              className="font-medium text-zinc-950 hover:underline"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
