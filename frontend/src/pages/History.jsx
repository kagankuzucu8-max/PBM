import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fmtDate, verdictLabel, verdictTone } from "@/lib/format";
import { buildAnalysisChange } from "@/lib/analysisChange";

const VERDICT_STYLES = {
  bullish: "bg-emerald-100 text-emerald-700",
  bearish: "bg-rose-100 text-rose-700",
  neutral: "bg-zinc-100 text-zinc-700",
};

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("analysis_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems(data || []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">AI Engine</div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Analysis History</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Past Claude analyses on assets you reviewed. Click a row to expand.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-400">
            <HistoryIcon className="w-8 h-8 mx-auto text-zinc-300 mb-2" strokeWidth={1.25} />
            No analyses yet. Open an asset and run AI Analysis.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {items.map((it) => {
              const tone = verdictTone(it.verdict);
              const open = expanded === it.id;
              const previous = items.find(
                (candidate) =>
                  candidate.id !== it.id &&
                  candidate.symbol === it.symbol &&
                  candidate.timeframe === it.timeframe &&
                  new Date(candidate.created_at).getTime() < new Date(it.created_at).getTime(),
              );
              const change = it.payload?.change_tracking || buildAnalysisChange(previous, it);
              return (
                <li key={it.id} data-testid={`history-row-${it.symbol}`}>
                  <button
                    onClick={() => setExpanded(open ? null : it.id)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="font-semibold tabular-nums text-zinc-950 w-28 truncate">{it.symbol}</div>
                      <div className="text-xs text-zinc-500 uppercase tracking-[0.08em] w-12">{it.timeframe}</div>
                      <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${VERDICT_STYLES[tone]}`}>
                        {verdictLabel(it.verdict)}
                      </span>
                      <div className="text-xs text-zinc-500 truncate hidden md:block max-w-md">{it.summary}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-zinc-400 tabular-nums hidden sm:block">{fmtDate(it.created_at)}</div>
                      <div className={`text-sm font-bold tabular-nums ${tone === "bullish" ? "text-emerald-600" : tone === "bearish" ? "text-rose-600" : "text-zinc-700"}`}>
                        {Number(it.combined_score).toFixed(0)}
                      </div>
                      <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`} />
                    </div>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 grid gap-4 sm:grid-cols-3 bg-slate-50/50 border-t border-zinc-100">
                      <div className="sm:col-span-3 pt-4">
                        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500 mb-1">Summary</div>
                        <p className="text-sm text-zinc-800 leading-relaxed">{it.summary}</p>
                      </div>
                      <Section title="Short-term">{it.payload?.short_term_outlook || "—"}</Section>
                      <Section title="Medium-term">{it.payload?.medium_term_outlook || "—"}</Section>
                      <Section title="Risk">{it.payload?.risk_notes || "—"}</Section>
                      {change && (
                        <div className="sm:col-span-3 border border-zinc-200 bg-white rounded-md p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Analysis change</div>
                              <div className="text-sm font-semibold text-zinc-950 mt-1 capitalize">{change.direction}</div>
                            </div>
                            {change.score_delta != null && (
                              <div className={`text-sm font-bold tabular-nums ${
                                change.score_delta > 0 ? "text-emerald-600" : change.score_delta < 0 ? "text-rose-600" : "text-zinc-700"
                              }`}>
                                {change.score_delta > 0 ? "+" : ""}{change.score_delta.toFixed(0)} score
                              </div>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3 mt-3">
                            {change.notes?.map((note) => (
                              <div key={note} className="text-xs text-zinc-600 leading-relaxed">{note}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="sm:col-span-3">
                        <button
                          onClick={() => navigate(`/asset/${it.symbol}`)}
                          data-testid={`history-open-${it.symbol}`}
                          className="text-xs font-semibold text-zinc-950 hover:underline"
                        >
                          Open asset →
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500 mb-1">{title}</div>
      <p className="text-sm text-zinc-700 leading-relaxed">{children}</p>
    </div>
  );
}
