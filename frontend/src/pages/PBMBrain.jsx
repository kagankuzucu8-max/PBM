import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrainCircuit, Database, Download, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { runPBMBrain } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtDate, fmtPrice } from "@/lib/format";

const defaultQuestion =
  "Review my latest journal, social position posts, AI history, and saved memories. Tell me what PBM Brain should learn next.";

const emptyMemory = {
  memory_type: "note",
  title: "",
  content: "",
  weight: "1",
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const tableRead = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const earliestDate = (groups) => {
  const dates = groups
    .flat()
    .map((item) => item?.created_at || item?.trade_date || item?.record_date)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0]?.toISOString() || null;
};

const downloadJson = (payload, filename) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function PBMBrainPage() {
  const { user, isAdmin } = useAuth();
  const [question, setQuestion] = useState(defaultQuestion);
  const [journal, setJournal] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [socialPosts, setSocialPosts] = useState([]);
  const [memories, setMemories] = useState([]);
  const [runs, setRuns] = useState([]);
  const [exports, setExports] = useState([]);
  const [result, setResult] = useState(null);
  const [memoryForm, setMemoryForm] = useState(emptyMemory);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    setError("");
    try {
      const [
        journalRows,
        analysisRows,
        socialRows,
        memoryRows,
        runRows,
        exportRows,
      ] = await Promise.all([
        tableRead(
          supabase
            .from("journal_entries")
            .select("*")
            .eq("user_id", user.id)
            .order("trade_date", { ascending: false })
            .limit(180)
        ),
        tableRead(
          supabase
            .from("analysis_history")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(80)
        ),
        tableRead(
          supabase
            .from("social_posts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(80)
        ),
        tableRead(
          supabase
            .from("pbm_brain_memories")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(120)
        ),
        tableRead(
          supabase
            .from("pbm_brain_runs")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(60)
        ),
        isAdmin
          ? tableRead(
              supabase
                .from("pbm_brain_exports")
                .select("id,user_id,label,period_start,period_end,record_count,created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20)
            )
          : Promise.resolve([]),
      ]);

      setJournal(journalRows);
      setAnalyses(analysisRows);
      setSocialPosts(socialRows);
      setMemories(memoryRows);
      setRuns(runRows);
      setExports(exportRows);
      if (!result && runRows[0]?.payload?.result) setResult(runRows[0].payload.result);
    } catch (err) {
      setError(err.message || "PBM Brain data could not be loaded.");
    }
    setLoading(false);
  }, [isAdmin, result, user]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const profile = useMemo(() => {
    const pnlRows = journal.map((entry) => Number(entry.pnl)).filter((value) => Number.isFinite(value));
    const wins = pnlRows.filter((value) => value > 0).length;
    const total = pnlRows.reduce((sum, value) => sum + value, 0);
    return {
      journal_count: journal.length,
      analysis_count: analyses.length,
      social_post_count: socialPosts.length,
      memory_count: memories.length,
      run_count: runs.length,
      total_pnl: total,
      win_rate: pnlRows.length ? (wins / pnlRows.length) * 100 : 0,
    };
  }, [analyses.length, journal, memories.length, runs.length, socialPosts.length]);

  const snapshot = useMemo(
    () => ({
      journal,
      analyses,
      social_posts: socialPosts,
      memories,
    }),
    [analyses, journal, memories, socialPosts]
  );

  const handleRunBrain = async () => {
    setError("");
    setRunning(true);
    try {
      const response = await runPBMBrain({
        question: question.trim() || defaultQuestion,
        ...snapshot,
      });
      const payload = {
        result: response,
        snapshot,
        question: question.trim() || defaultQuestion,
        saved_at: new Date().toISOString(),
      };
      const { data, error: insertError } = await supabase
        .from("pbm_brain_runs")
        .insert({
          user_id: user.id,
          question: question.trim() || defaultQuestion,
          router_topic: response.router_topic || "router",
          expert: response.expert || "PBM Router Head",
          setup_score: Number(response.setup_score ?? 0),
          confidence: Number(response.confidence ?? 0),
          summary: response.summary || "",
          recommendations: toArray(response.recommendations),
          risks: toArray(response.risks),
          payload,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      setResult(response);
      setRuns((items) => [data, ...items].slice(0, 60));
    } catch (err) {
      setError(err.message || "PBM Brain run failed.");
    }
    setRunning(false);
  };

  const addMemory = async (event) => {
    event.preventDefault();
    setError("");
    if (!memoryForm.title.trim()) {
      setError("Memory title is required.");
      return;
    }
    setSavingMemory(true);
    try {
      const { data, error: insertError } = await supabase
        .from("pbm_brain_memories")
        .insert({
          user_id: user.id,
          memory_type: memoryForm.memory_type,
          title: memoryForm.title.trim(),
          content: memoryForm.content.trim(),
          weight: Number(memoryForm.weight || 1),
          payload: { source: "manual", created_from: "pbm_brain" },
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      setMemories((items) => [data, ...items]);
      setMemoryForm(emptyMemory);
    } catch (err) {
      setError(err.message || "Memory could not be saved.");
    }
    setSavingMemory(false);
  };

  const fetchFullExportData = async () => {
    const [
      journalRows,
      analysisRows,
      socialRows,
      memoryRows,
      runRows,
      exportRows,
    ] = await Promise.all([
      tableRead(
        supabase
          .from("journal_entries")
          .select("*")
          .eq("user_id", user.id)
          .order("trade_date", { ascending: false })
          .limit(2000)
      ),
      tableRead(
        supabase
          .from("analysis_history")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(2000)
      ),
      tableRead(
        supabase
          .from("social_posts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(2000)
      ),
      tableRead(
        supabase
          .from("pbm_brain_memories")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(2000)
      ),
      tableRead(
        supabase
          .from("pbm_brain_runs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(2000)
      ),
      tableRead(
        supabase
          .from("pbm_brain_exports")
          .select("id,label,period_start,period_end,record_count,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200)
      ),
    ]);

    return {
      journal: journalRows,
      analyses: analysisRows,
      social_posts: socialRows,
      memories: memoryRows,
      brain_runs: runRows,
      previous_exports: exportRows,
    };
  };

  const exportBrainData = async () => {
    if (!isAdmin) return;
    setError("");
    setExporting(true);
    try {
      const allData = await fetchFullExportData();
      const exportedAt = new Date();
      const groups = Object.values(allData).filter(Array.isArray);
      const recordCount = groups.reduce((sum, group) => sum + group.length, 0);
      const payload = {
        app: "PBM",
        type: "pbm_brain_weekend_export",
        user: { id: user.id, email: user.email },
        exported_at: exportedAt.toISOString(),
        data: allData,
      };
      const label = `PBM Brain Export ${exportedAt.toISOString().slice(0, 10)}`;
      const { data, error: insertError } = await supabase
        .from("pbm_brain_exports")
        .insert({
          user_id: user.id,
          label,
          period_start: earliestDate(groups),
          period_end: exportedAt.toISOString(),
          record_count: recordCount,
          payload,
        })
        .select("id,user_id,label,period_start,period_end,record_count,created_at")
        .single();
      if (insertError) throw insertError;
      setExports((items) => [data, ...items].slice(0, 20));
      downloadJson(payload, `pbm-brain-export-${exportedAt.toISOString().slice(0, 10)}.json`);
    } catch (err) {
      setError(err.message || "PBM Brain export failed.");
    }
    setExporting(false);
  };

  const activeRun = result || runs[0]?.payload?.result || runs[0];
  const recommendations = toArray(activeRun?.recommendations);
  const risks = toArray(activeRun?.risks);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">PBM Brain</div>
          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">PBM Brain</h1>
          <p className="text-sm text-zinc-500 mt-1.5">
            Private expert-router memory for your journal, position posts, and AI history.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={exportBrainData}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-60"
            data-testid="pbm-brain-export"
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
            {exporting ? "Exporting..." : "Export data"}
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Expert" value={activeRun?.expert || "PBM Router Head"} />
        <Stat label="Brain Score" value={activeRun?.setup_score != null ? `${Math.round(activeRun.setup_score)}/100` : "--"} />
        <Stat label="Memory" value={`${profile.memory_count} notes`} />
        <Stat label="Win Rate" value={`${profile.win_rate.toFixed(1)}%`} tone={profile.total_pnl >= 0 ? "bullish" : "bearish"} />
      </div>

      {error && (
        <div className="bg-white border border-rose-200 rounded-lg px-5 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      <div className="grid xl:grid-cols-[420px_1fr] gap-5">
        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              Router prompt
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={7}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                data-testid="pbm-brain-question"
              />
              <button
                onClick={handleRunBrain}
                disabled={running || loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium h-10 hover:bg-zinc-800 transition-colors disabled:opacity-60"
                data-testid="pbm-brain-run"
              >
                <BrainCircuit className="w-4 h-4" strokeWidth={1.75} />
                {running ? "Running..." : "Run PBM Brain"}
              </button>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              Save memory
            </div>
            <form onSubmit={addMemory} className="p-5 space-y-3" data-testid="pbm-brain-memory-form">
              <select
                value={memoryForm.memory_type}
                onChange={(event) => setMemoryForm({ ...memoryForm, memory_type: event.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="note">Note</option>
                <option value="setup">Setup</option>
                <option value="mistake">Mistake</option>
                <option value="rule">Rule</option>
                <option value="model">Model idea</option>
              </select>
              <input
                value={memoryForm.title}
                onChange={(event) => setMemoryForm({ ...memoryForm, title: event.target.value })}
                placeholder="Memory title"
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <textarea
                value={memoryForm.content}
                onChange={(event) => setMemoryForm({ ...memoryForm, content: event.target.value })}
                placeholder="What should PBM Brain remember?"
                rows={4}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              />
              <button
                disabled={savingMemory}
                className="w-full inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium h-10 hover:bg-zinc-800 transition-colors disabled:opacity-60"
              >
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                {savingMemory ? "Saving..." : "Add memory"}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
                Expert output
              </div>
              <div className="text-xs text-zinc-400 tabular-nums">
                {activeRun?.confidence != null ? `${Math.round(Number(activeRun.confidence) * 100)}% confidence` : "No run yet"}
              </div>
            </div>
            {!activeRun ? (
              <div className="px-5 py-24 text-center text-sm text-zinc-400">
                <Sparkles className="w-8 h-8 mx-auto text-zinc-300 mb-2" strokeWidth={1.25} />
                Run PBM Brain to build the first private learning snapshot.
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div>
                  <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Summary</div>
                  <p className="text-sm text-zinc-700 leading-6 mt-2">{activeRun.summary || "No summary saved."}</p>
                </div>
                <div className="grid lg:grid-cols-2 gap-5">
                  <ResultList title="Recommendations" items={recommendations} empty="No recommendations yet." />
                  <ResultList title="Risks" items={risks} empty="No risks yet." tone="risk" />
                </div>
                {activeRun.next_memory && (
                  <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                    <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
                      Next memory
                    </div>
                    <div className="text-sm text-zinc-700 leading-6 mt-2">{activeRun.next_memory}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={isAdmin ? "grid lg:grid-cols-2 gap-5" : ""}>
            <DataPanel title="Source data" icon={Database}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Journal" value={profile.journal_count} />
                <MiniStat label="AI history" value={profile.analysis_count} />
                <MiniStat label="Social posts" value={profile.social_post_count} />
                <MiniStat label="Total P&L" value={`$${fmtPrice(profile.total_pnl, 2)}`} />
                <MiniStat label="Runs" value={profile.run_count} />
              </div>
            </DataPanel>

            {isAdmin && (
              <DataPanel title="Weekend exports" icon={Download}>
                {exports.length === 0 ? (
                  <div className="py-10 text-center text-sm text-zinc-400">No exports yet.</div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {exports.slice(0, 4).map((item) => (
                      <div key={item.id} className="py-3">
                        <div className="text-sm font-semibold text-zinc-950 truncate">{item.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                          {item.record_count} records - {fmtDate(item.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DataPanel>
            )}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
            Recent runs
          </div>
          {loading ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-400">Loading...</div>
          ) : runs.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-400">No PBM Brain runs yet.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {runs.slice(0, 8).map((run) => (
                <button
                  key={run.id}
                  onClick={() => setResult(run.payload?.result || run)}
                  className="w-full px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-950 truncate">{run.expert}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 truncate">{run.question || "PBM Brain review"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums">{run.setup_score ?? "--"}</div>
                      <div className="text-xs text-zinc-400 tabular-nums">{fmtDate(run.created_at)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
            Memory bank
          </div>
          {memories.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-400">No memories saved yet.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {memories.slice(0, 8).map((memory) => (
                <div key={memory.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-zinc-950 truncate">{memory.title}</div>
                    <div className="text-[10px] tracking-[0.08em] uppercase text-zinc-400 font-semibold">
                      {memory.memory_type}
                    </div>
                  </div>
                  {memory.content && <div className="text-xs text-zinc-500 leading-5 mt-1.5 line-clamp-2">{memory.content}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 min-h-[96px]">
      <div className="text-[11px] tracking-[0.08em] uppercase font-semibold text-zinc-500">{label}</div>
      <div
        className={`text-2xl font-heading font-bold tabular-nums tracking-tight mt-2 truncate ${
          tone === "bullish" ? "text-emerald-600" : tone === "bearish" ? "text-rose-600" : "text-zinc-950"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ResultList({ title, items, empty, tone }) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-zinc-400 mt-2">{empty}</div>
      ) : (
        <div className="space-y-2 mt-2">
          {items.map((item, index) => (
            <div key={`${title}-${index}`} className="flex gap-2 text-sm text-zinc-700 leading-6">
              <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${tone === "risk" ? "bg-rose-500" : "bg-emerald-500"}`} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataPanel({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
        {title}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="border border-zinc-200 rounded-lg p-3 bg-white">
      <div className="text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">{label}</div>
      <div className="text-lg font-heading font-bold text-zinc-950 tabular-nums mt-1 truncate">{value}</div>
    </div>
  );
}
