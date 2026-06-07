import React from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Loader2, RefreshCw } from "lucide-react";
import { verdictLabel, verdictTone, fmtPrice } from "@/lib/format";

function VerdictBadge({ verdict, confidence }) {
  const tone = verdictTone(verdict);
  const styles = {
    bullish: { bg: "bg-emerald-100", color: "text-emerald-700", icon: TrendingUp },
    bearish: { bg: "bg-rose-100", color: "text-rose-700", icon: TrendingDown },
    neutral: { bg: "bg-zinc-100", color: "text-zinc-700", icon: Minus },
  }[tone];
  const Icon = styles.icon;
  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${styles.bg}`}>
      <Icon className={`w-4 h-4 ${styles.color}`} strokeWidth={2} />
      <span className={`text-sm font-semibold ${styles.color}`}>{verdictLabel(verdict)}</span>
      {confidence != null && (
        <span className={`text-xs tabular-nums ${styles.color} opacity-80`}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}

export default function AIAnalysisPanel({ analysis, loading, onRun, lastUpdated, error, usage, isAdmin }) {
  const showUsage = !isAdmin && usage?.limit != null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-white/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-slate-500">AI Engine</div>
            <div className="text-lg font-heading font-bold tracking-tight text-slate-900">Claude Sonnet 4.5 Analysis</div>
          </div>
        </div>
        {showUsage && (
          <div className="text-xs text-slate-500 tabular-nums">
            AI left: <span className="font-semibold text-slate-900">{usage.remaining}</span>/{usage.limit} today
          </div>
        )}
        <button
          onClick={onRun}
          disabled={loading || (showUsage && usage.remaining <= 0)}
          data-testid="run-ai-analysis-btn"
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Analyzing…" : analysis ? "Re-analyze" : "Run AI Analysis"}
        </button>
      </div>

      {error && (
        <div className="px-6 py-4 bg-rose-50 border-b border-rose-200 text-sm text-rose-700" data-testid="ai-error">
          {error}
        </div>
      )}

      {!analysis && !loading && (
        <div className="p-10 text-center">
          <Sparkles className="w-10 h-10 mx-auto text-slate-300 mb-3" strokeWidth={1.25} />
          <div className="text-sm text-slate-600 max-w-md mx-auto">
            Run AI analysis to get a deep technical breakdown, pattern recognition, key levels, and risk notes for this asset.
          </div>
        </div>
      )}

      {loading && !analysis && (
        <div className="p-10 space-y-3">
          <div className="h-4 bg-slate-200 rounded animate-pulse w-2/3" />
          <div className="h-4 bg-slate-200 rounded animate-pulse w-full" />
          <div className="h-4 bg-slate-200 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
        </div>
      )}

      {analysis && (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <VerdictBadge verdict={analysis.verdict} confidence={analysis.confidence} />
            <div className="flex items-center gap-4 text-xs text-slate-500 tabular-nums">
              <div>
                Tech score: <span className="font-semibold text-slate-700">{analysis.technical_score?.toFixed(0)}</span>
              </div>
              <div>
                AI score: <span className="font-semibold text-slate-700">{analysis.ai_score?.toFixed(0)}</span>
              </div>
              <div>
                Combined: <span className="font-bold text-slate-900">{analysis.combined_score?.toFixed(0)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-slate-500 mb-2">Executive Summary</div>
            <p className="text-sm text-slate-800 leading-relaxed" data-testid="ai-summary">{analysis.summary}</p>
          </div>

          {analysis.change_tracking && (
            <div className="bg-white border border-slate-200 rounded-md p-4" data-testid="analysis-change-tracking">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-600" strokeWidth={1.75} />
                  <div>
                    <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-slate-500">Analysis Change</div>
                    <div className="text-sm font-semibold text-slate-950 mt-0.5 capitalize">
                      {analysis.change_tracking.direction}
                    </div>
                  </div>
                </div>
                {analysis.change_tracking.score_delta != null && (
                  <div className="text-right">
                    <div className="text-[11px] uppercase font-semibold text-slate-500">Score change</div>
                    <div className={`text-xl font-semibold tabular-nums ${
                      analysis.change_tracking.score_delta > 0
                        ? "text-emerald-600"
                        : analysis.change_tracking.score_delta < 0
                          ? "text-rose-600"
                          : "text-slate-700"
                    }`}>
                      {analysis.change_tracking.score_delta > 0 ? "+" : ""}
                      {analysis.change_tracking.score_delta.toFixed(0)}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] uppercase font-semibold text-slate-500">Previous</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">
                    {verdictLabel(analysis.change_tracking.previous_verdict)}
                    {analysis.change_tracking.previous_score != null && ` / ${analysis.change_tracking.previous_score.toFixed(0)}`}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] uppercase font-semibold text-slate-500">Current</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">
                    {verdictLabel(analysis.change_tracking.current_verdict)}
                    {analysis.change_tracking.current_score != null && ` / ${analysis.change_tracking.current_score.toFixed(0)}`}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                {analysis.change_tracking.notes?.map((note) => (
                  <div key={note} className="text-xs text-slate-600 leading-relaxed">{note}</div>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-slate-500 mb-1.5">Short-term outlook</div>
              <p className="text-sm text-slate-700 leading-relaxed">{analysis.short_term_outlook}</p>
            </div>
            <div>
              <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-slate-500 mb-1.5">Medium-term outlook</div>
              <p className="text-sm text-slate-700 leading-relaxed">{analysis.medium_term_outlook}</p>
            </div>
          </div>

          {analysis.patterns?.length > 0 && (
            <div>
              <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-slate-500 mb-2">Detected patterns</div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {analysis.patterns.map((p, i) => {
                  const tone = p.direction === "bullish" ? "emerald" : p.direction === "bearish" ? "rose" : "zinc";
                  return (
                    <div key={i} className="bg-white border border-slate-200 rounded-md p-3" data-testid={`ai-pattern-${i}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className={`text-sm font-semibold text-${tone}-700 capitalize`}>{p.name}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">{Math.round((p.confidence || 0) * 100)}%</div>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 leading-relaxed">{p.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(analysis.key_levels?.support?.length > 0 || analysis.key_levels?.resistance?.length > 0) && (
            <div>
              <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Key Levels
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3">
                  <div className="text-[11px] uppercase font-semibold text-emerald-700 mb-1">Support</div>
                  <div className="space-y-0.5">
                    {(analysis.key_levels.support || []).map((s, i) => (
                      <div key={i} className="text-sm font-medium tabular-nums text-emerald-900">{fmtPrice(s)}</div>
                    ))}
                  </div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-md p-3">
                  <div className="text-[11px] uppercase font-semibold text-rose-700 mb-1">Resistance</div>
                  <div className="space-y-0.5">
                    {(analysis.key_levels.resistance || []).map((r, i) => (
                      <div key={i} className="text-sm font-medium tabular-nums text-rose-900">{fmtPrice(r)}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {analysis.risk_notes && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" strokeWidth={2} />
              <div>
                <div className="text-[11px] uppercase font-semibold text-amber-700 mb-0.5">Risk notes</div>
                <div className="text-sm text-amber-900 leading-relaxed">{analysis.risk_notes}</div>
              </div>
            </div>
          )}

          {analysis.pbm_prediction && (
            <div className="bg-white border border-slate-200 rounded-md p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-slate-500 mb-1">PBM Prediction Bias</div>
                  <div className="text-lg font-heading font-bold text-slate-950">{analysis.pbm_prediction.signal}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase font-semibold text-slate-500">Confidence</div>
                  <div className="text-2xl font-semibold tabular-nums text-slate-950">{analysis.pbm_prediction.confidence_pct}%</div>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mt-3">{analysis.pbm_prediction.statement}</p>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] uppercase font-semibold text-slate-500 mb-1">Target zone</div>
                  <div className="text-sm font-medium tabular-nums text-slate-900">
                    {analysis.pbm_prediction.target_zone?.length
                      ? analysis.pbm_prediction.target_zone.map((level) => fmtPrice(level)).join(" / ")
                      : "Waiting"}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] uppercase font-semibold text-slate-500 mb-1">Invalidation</div>
                  <div className="text-sm font-medium tabular-nums text-slate-900">
                    {analysis.pbm_prediction.invalidation != null ? fmtPrice(analysis.pbm_prediction.invalidation) : "Range break"}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] uppercase font-semibold text-slate-500 mb-1">ML memory</div>
                  <div className="text-sm font-medium tabular-nums text-slate-900">
                    {analysis.pbm_prediction.ml_memory_count || 0} active
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 leading-relaxed mt-3">{analysis.pbm_prediction.learning_note}</div>
              {analysis.cache?.hit && (
                <div className="text-[11px] text-slate-400 mt-2">Served from PBM cache to save AI cost.</div>
              )}
            </div>
          )}

          {lastUpdated && (
            <div className="text-[11px] text-slate-400 text-right">Last updated: {lastUpdated}</div>
          )}
        </div>
      )}
    </div>
  );
}
