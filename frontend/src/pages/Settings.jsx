import React, { useEffect, useState } from "react";
import { Save, Database, Key } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { TIMEFRAMES } from "@/lib/market";

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const [settings, setSettings] = useState({ default_timeframe: "1h", default_market: "crypto", theme: "light" });
  const [alphaKey, setAlphaKey] = useState(localStorage.getItem("md.alpha_key") || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setSettings({ default_timeframe: data.default_timeframe, default_market: data.default_market, theme: data.theme });
    })();
  }, [user]);

  const save = async () => {
    setSaving(true);
    await supabase.from("user_settings").upsert({
      user_id: user.id,
      ...settings,
    });
    localStorage.setItem("md.tf", settings.default_timeframe);
    localStorage.setItem("md.alpha_key", alphaKey);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Configuration</div>
          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1.5">This panel is only available for PBM admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Configuration</div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Personalize defaults and configure optional API keys.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Defaults</div>
        <div className="p-5 grid sm:grid-cols-2 gap-5">
          <Field label="Default Timeframe">
            <select
              value={settings.default_timeframe}
              onChange={(e) => setSettings({ ...settings, default_timeframe: e.target.value })}
              data-testid="settings-timeframe"
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {TIMEFRAMES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
            </select>
          </Field>
          <Field label="Default Market">
            <select
              value={settings.default_market}
              onChange={(e) => setSettings({ ...settings, default_market: e.target.value })}
              data-testid="settings-market"
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="crypto">Crypto</option>
              <option value="stock">Stock</option>
              <option value="forex">Forex</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500 flex items-center gap-2">
          <Key className="w-3.5 h-3.5" /> Optional API keys (stored in your browser only)
        </div>
        <div className="p-5">
          <Field label="Alpha Vantage API key (for stocks)">
            <input
              type="password"
              value={alphaKey}
              onChange={(e) => setAlphaKey(e.target.value)}
              placeholder="Optional"
              data-testid="settings-alpha-key"
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </Field>
          <div className="text-xs text-zinc-500 mt-2">Get a free key at alphavantage.co. Used only client-side; never sent to PBM servers.</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={save}
          disabled={saving}
          data-testid="settings-save-btn"
          className="inline-flex items-center gap-2 bg-zinc-950 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <div className="text-xs text-emerald-600 font-semibold" data-testid="settings-saved">Saved.</div>}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-slate-600" />
          <div className="text-sm font-semibold text-slate-900">Database setup</div>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          If watchlists/alerts/history aren't saving, run the SQL schema in your Supabase project's SQL Editor.
          Schema lives at <code className="px-1 py-0.5 bg-slate-200 rounded text-[11px]">/app/supabase/schema.sql</code>.
          It creates tables and RLS policies. Idempotent — safe to re-run.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.08em] uppercase font-semibold text-zinc-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}
