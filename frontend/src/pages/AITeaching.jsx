import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Save, Download, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fmtDate } from "@/lib/format";
import { exportMLTrainingData, importMLMemory } from "@/lib/api";

export default function AITeachingPage() {
  const { user, isAdmin } = useAuth();
  const [analyses, setAnalyses] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mlJson, setMlJson] = useState("");
  const [mlStatus, setMlStatus] = useState("");

  const feedbackByAnalysis = useMemo(() => {
    const map = new Map();
    Object.values(feedback).forEach((item) => {
      if (item.analysis_history_id) map.set(item.analysis_history_id, item);
    });
    return map;
  }, [feedback]);

  const reload = useCallback(async () => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }
    setError("");
    const [{ data: rows, error: rowsError }, { data: teachingRows, error: teachingError }] = await Promise.all([
      supabase
        .from("analysis_history")
        .select("id,symbol,market,timeframe,verdict,combined_score,summary,payload,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ai_teaching_feedback")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (rowsError || teachingError) setError(rowsError?.message || teachingError?.message);
    setAnalyses(rows || []);
    const next = {};
    (teachingRows || []).forEach((item) => {
      if (item.analysis_history_id && !next[item.analysis_history_id]) next[item.analysis_history_id] = item;
    });
    setFeedback(next);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveFeedback = async (analysis, outcome) => {
    const existing = feedback[analysis.id] || {};
    const note = existing.feedback || "";
    const lesson = outcome === "correct"
      ? `This analysis worked. Continue similar weighting for ${analysis.symbol} ${analysis.timeframe}. ${note}`.trim()
      : note.trim();
    setSavingId(analysis.id);
    setError("");
    const payload = {
      user_id: user.id,
      analysis_history_id: analysis.id,
      symbol: analysis.symbol,
      market: analysis.market,
      timeframe: analysis.timeframe,
      outcome,
      feedback: note.trim(),
      lesson,
      payload: analysis.payload || {},
    };
    const { error: insertError } = await supabase
      .from("ai_teaching_feedback")
      .insert(payload);
    if (insertError) setError(insertError.message);
    else setFeedback((items) => ({ ...items, [analysis.id]: { ...payload, created_at: new Date().toISOString() } }));
    setSavingId(null);
  };

  const exportWeeklyDataset = async () => {
    setExporting(true);
    setError("");
    setMlStatus("");
    try {
      const payload = await exportMLTrainingData({ days: 7 });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pbm-ml-training-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMlStatus(`Exported ${payload.counts?.training_rows || 0} ML training rows.`);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "ML export failed");
    } finally {
      setExporting(false);
    }
  };

  const importTrainedMemory = async () => {
    setImporting(true);
    setError("");
    setMlStatus("");
    try {
      const payload = JSON.parse(mlJson);
      const res = await importMLMemory(payload);
      setMlStatus(`Imported ${res.memory?.title || "PBM ML memory"}.`);
      setMlJson("");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "ML import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Admin</div>
          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">AI Teaching</h1>
          <p className="text-sm text-zinc-500 mt-1.5">This panel is only available for PBM admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Admin</div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">AI Teaching</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Mark AI analyses as correct or wrong and store the lesson for the next analysis loop.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
            Weekly ML dataset
          </div>
          <div className="p-5">
            <p className="text-sm text-zinc-600 leading-relaxed">
              Export the last 7 days of AI analyses, teaching feedback, journal rows, social posts, and PBM Brain memory for local ML training.
            </p>
            <button
              onClick={exportWeeklyDataset}
              disabled={exporting}
              className="mt-4 inline-flex items-center justify-center gap-2 bg-zinc-950 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {exporting ? "Exporting..." : "Export 7 days"}
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
            Import trained ML memory
          </div>
          <div className="p-5">
            <textarea
              value={mlJson}
              onChange={(event) => setMlJson(event.target.value)}
              rows={4}
              placeholder='{"model_version":"weekly-001","summary":"BTC 1H trend setups improved with volume confirmation.","rules":[],"metrics":{}}'
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
            />
            <button
              onClick={importTrainedMemory}
              disabled={importing || !mlJson.trim()}
              className="mt-3 inline-flex items-center justify-center gap-2 bg-zinc-950 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              <UploadCloud className="w-4 h-4" />
              {importing ? "Importing..." : "Import memory"}
            </button>
          </div>
        </div>
      </div>

      {mlStatus && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-lg text-sm">
          {mlStatus}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
          Recent analyses
        </div>
        {error && <div className="px-5 py-3 border-b border-rose-100 bg-rose-50 text-sm text-rose-700">{error}</div>}
        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-400">Loading...</div>
        ) : analyses.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-400">No AI analyses yet.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {analyses.map((analysis) => {
              const saved = feedbackByAnalysis.get(analysis.id);
              const draft = feedback[analysis.id] || {};
              return (
                <div key={analysis.id} className="p-4 md:p-5 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 min-w-0">
                    <div className="min-w-0">
                      <div className="font-semibold tabular-nums text-zinc-950">{analysis.symbol}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 break-words">
                        {analysis.timeframe} / {analysis.verdict} / Score {Number(analysis.combined_score || 0).toFixed(0)}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400 tabular-nums shrink-0">{fmtDate(analysis.created_at)}</div>
                  </div>
                  {analysis.summary && <p className="text-sm text-zinc-700 leading-relaxed mt-3 break-words">{analysis.summary}</p>}
                  <textarea
                    value={draft.feedback || ""}
                    onChange={(event) => setFeedback((items) => ({
                      ...items,
                      [analysis.id]: { ...items[analysis.id], analysis_history_id: analysis.id, feedback: event.target.value },
                    }))}
                    rows={3}
                    placeholder="If wrong, explain what actually happened and where the model missed it."
                    className="w-full mt-4 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                    <div className="text-xs text-zinc-500">
                      {saved ? `Saved as ${saved.outcome}` : "No teaching feedback yet."}
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 min-w-0">
                      <button
                        onClick={() => saveFeedback(analysis, "correct")}
                        disabled={savingId === analysis.id}
                        className="min-w-0 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Correct
                      </button>
                      <button
                        onClick={() => saveFeedback(analysis, "wrong")}
                        disabled={savingId === analysis.id}
                        className="min-w-0 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-zinc-950 text-white hover:bg-zinc-800 transition-colors disabled:opacity-60"
                      >
                        {savingId === analysis.id ? <Save className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} Wrong / Teach
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
