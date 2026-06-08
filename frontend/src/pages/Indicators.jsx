import React, { useEffect, useMemo, useState } from "react";
import { ChartNoAxesCombined, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fmtDate } from "@/lib/format";
import {
  addTradingViewIndicator,
  deleteTradingViewIndicator,
  listTradingViewIndicators,
  updateTradingViewIndicator,
} from "@/lib/api";

const emptyForm = { title: "", tradingview_url: "", banner_url: "", description: "" };

export default function IndicatorsPage() {
  const { isAdmin } = useAuth();
  const [indicators, setIndicators] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const activeIndicator = useMemo(
    () => indicators.find((indicator) => indicator.id === activeId) || indicators[0],
    [activeId, indicators],
  );

  const reload = async () => {
    try {
      setIndicators((await listTradingViewIndicators()) || []);
      setError("");
    } catch (loadError) {
      setError(loadError.response?.data?.detail || loadError.message || "Indicators could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const saveIndicator = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.title.trim() || !form.tradingview_url.trim()) {
      setError("Indicator name and public TradingView link are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        tradingview_url: form.tradingview_url.trim(),
        banner_url: form.banner_url.trim(),
        description: form.description.trim(),
      };
      if (editingId) await updateTradingViewIndicator(editingId, payload);
      else await addTradingViewIndicator(payload);
      setForm(emptyForm);
      setEditingId(null);
      await reload();
    } catch (insertError) {
      setError(insertError.response?.data?.detail || insertError.message || "Indicator could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const editIndicator = (indicator) => {
    setEditingId(indicator.id);
    setActiveId(indicator.id);
    setForm({
      title: indicator.title || "",
      tradingview_url: indicator.tradingview_url || "",
      banner_url: indicator.banner_url || "",
      description: indicator.description || "",
    });
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const deleteIndicator = async (indicator) => {
    if (!window.confirm("Delete this indicator?")) return;
    try {
      await deleteTradingViewIndicator(indicator.id);
      setIndicators((items) => items.filter((item) => item.id !== indicator.id));
      if (activeId === indicator.id) setActiveId(null);
    } catch (deleteError) {
      setError(deleteError.response?.data?.detail || deleteError.message || "Indicator could not be deleted.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">TradingView</div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Indicators</h1>
        <p className="text-sm text-zinc-500 mt-1.5">PBM indicator library with public TradingView access links.</p>
      </div>

      <div className="grid xl:grid-cols-[420px_1fr] gap-5 items-start">
        <div className="space-y-5">
          {isAdmin && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
                {editingId ? "Edit indicator" : "New indicator"}
              </div>
              <form onSubmit={saveIndicator} className="p-5 space-y-3" data-testid="indicator-form">
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Indicator name"
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <input
                  value={form.tradingview_url}
                  onChange={(event) => setForm({ ...form, tradingview_url: event.target.value })}
                  placeholder="Public TradingView link"
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <input
                  value={form.banner_url}
                  onChange={(event) => setForm({ ...form, banner_url: event.target.value })}
                  placeholder="Banner URL (optional - TradingView image is automatic)"
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={3}
                  placeholder="Short description (optional)"
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                />
                {error && <div className="text-xs text-rose-600">{error}</div>}
                <div className="flex gap-2">
                  <button
                    disabled={saving}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium h-10 hover:bg-zinc-800 transition-colors disabled:opacity-60"
                  >
                    {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingId ? "Save changes" : "Add indicator"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="w-10 h-10 inline-flex items-center justify-center border border-zinc-200 rounded-md text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
                      aria-label="Cancel editing"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              Library
            </div>
            {error && !isAdmin && <div className="px-5 py-3 border-b border-rose-100 bg-rose-50 text-xs text-rose-700">{error}</div>}
            {loading ? (
              <div className="px-5 py-16 text-center text-sm text-zinc-400">Loading...</div>
            ) : indicators.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm text-zinc-400">No indicators yet.</div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {indicators.map((indicator) => (
                  <li key={indicator.id} className="group">
                    <button
                      type="button"
                      onClick={() => setActiveId(indicator.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        activeIndicator?.id === indicator.id ? "bg-zinc-50" : "hover:bg-zinc-50"
                      }`}
                    >
                      <BannerThumb indicator={indicator} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-950 truncate">{indicator.title}</div>
                        <div className="text-xs text-zinc-400 tabular-nums mt-0.5">{fmtDate(indicator.created_at)}</div>
                      </div>
                      {isAdmin && (
                        <span className="flex items-center gap-0.5">
                          <span
                            onClick={(event) => { event.stopPropagation(); editIndicator(indicator); }}
                            className="p-1.5 text-zinc-400 hover:text-zinc-950 transition-colors"
                            role="button"
                            tabIndex={0}
                            aria-label="Edit indicator"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </span>
                          <span
                            onClick={(event) => { event.stopPropagation(); deleteIndicator(indicator); }}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                            role="button"
                            tabIndex={0}
                            aria-label="Delete indicator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </span>
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
            Indicator
          </div>
          {!activeIndicator ? (
            <div className="px-5 py-24 text-center text-sm text-zinc-400">
              <ChartNoAxesCombined className="w-8 h-8 mx-auto text-zinc-300 mb-2" strokeWidth={1.25} />
              Select an indicator.
            </div>
          ) : (
            <div>
              <div className="aspect-[16/7] bg-zinc-950 overflow-hidden flex items-center justify-center">
                {activeIndicator.banner_url ? (
                  <img src={activeIndicator.banner_url} alt={activeIndicator.title} className="w-full h-full object-cover" />
                ) : (
                  <ChartNoAxesCombined className="w-14 h-14 text-white/30" strokeWidth={1.25} />
                )}
              </div>
              <div className="p-5">
                <div className="font-heading font-extrabold text-xl text-zinc-950">{activeIndicator.title}</div>
                {activeIndicator.description && (
                  <p className="text-sm text-zinc-600 leading-relaxed mt-2 whitespace-pre-wrap">{activeIndicator.description}</p>
                )}
                <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-zinc-100">
                  <div className="text-xs text-zinc-400">PBM Indicator Library</div>
                  <a
                    href={activeIndicator.tradingview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-zinc-950 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors"
                  >
                    Open in TradingView <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BannerThumb({ indicator }) {
  return (
    <div className="w-20 h-12 bg-zinc-950 border border-zinc-200 rounded overflow-hidden shrink-0 flex items-center justify-center">
      {indicator.banner_url ? (
        <img src={indicator.banner_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <ChartNoAxesCombined className="w-5 h-5 text-white/50" strokeWidth={1.5} />
      )}
    </div>
  );
}
