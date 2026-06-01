import React, { useEffect, useState } from "react";
import { BellRing, Trash2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fmtDate } from "@/lib/format";

const CONDITIONS = [
  { id: "price_above", label: "Price above" },
  { id: "price_below", label: "Price below" },
  { id: "rsi_above", label: "RSI above" },
  { id: "rsi_below", label: "RSI below" },
  { id: "pct_change_24h_above", label: "24h change above (%)" },
  { id: "pct_change_24h_below", label: "24h change below (%)" },
];

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState({ symbol: "BTCUSDT", market: "crypto", condition: "price_above", threshold: "" });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const { data } = await supabase.from("alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setAlerts(data || []);
  };
  useEffect(() => { if (user) reload(); }, [user]);

  const addAlert = async (e) => {
    e.preventDefault();
    if (!form.threshold) return;
    setSaving(true);
    await supabase.from("alerts").insert({
      user_id: user.id,
      symbol: form.symbol.toUpperCase(),
      market: form.market,
      condition: form.condition,
      threshold: parseFloat(form.threshold),
      active: true,
    });
    setForm({ ...form, threshold: "" });
    await reload();
    setSaving(false);
  };

  const toggle = async (a) => {
    await supabase.from("alerts").update({ active: !a.active }).eq("id", a.id);
    await reload();
  };

  const remove = async (id) => {
    await supabase.from("alerts").delete().eq("id", id);
    await reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Workspace</div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Alerts</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Define rules. (Server-side evaluation coming soon — alerts are stored and ready for the worker.)</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">New alert</div>
        <form onSubmit={addAlert} className="grid sm:grid-cols-5 gap-3 p-5" data-testid="new-alert-form">
          <input
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="Symbol"
            data-testid="alert-symbol-input"
            className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <select
            value={form.market}
            onChange={(e) => setForm({ ...form, market: e.target.value })}
            data-testid="alert-market-select"
            className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="crypto">Crypto</option>
            <option value="stock">Stock</option>
            <option value="forex">Forex</option>
          </select>
          <select
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            data-testid="alert-condition-select"
            className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            {CONDITIONS.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </select>
          <input
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            type="number"
            step="any"
            required
            placeholder="Threshold"
            data-testid="alert-threshold-input"
            className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <button
            type="submit"
            disabled={saving}
            data-testid="alert-submit-btn"
            className="inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </form>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Your alerts</div>
        {alerts.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-400">
            <BellRing className="w-8 h-8 mx-auto text-zinc-300 mb-2" strokeWidth={1.25} />
            No alerts yet.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Symbol</th>
                <th className="text-left px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Condition</th>
                <th className="text-right px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Threshold</th>
                <th className="text-left px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Created</th>
                <th className="text-center px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors group" data-testid={`alert-row-${a.symbol}`}>
                  <td className="px-5 py-3 font-semibold tabular-nums text-sm text-zinc-950">{a.symbol}</td>
                  <td className="px-5 py-3 text-sm text-zinc-700">{CONDITIONS.find((c) => c.id === a.condition)?.label}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-sm">{a.threshold}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{fmtDate(a.created_at)}</td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => toggle(a)}
                      data-testid={`alert-toggle-${a.symbol}`}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${a.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
                    >
                      {a.active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => remove(a.id)} data-testid={`alert-delete-${a.symbol}`} className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-600 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
