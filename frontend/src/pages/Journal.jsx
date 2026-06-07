import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, FileUp, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getMarketType } from "@/lib/market";
import { fmtDate, fmtPrice } from "@/lib/format";

const emptyForm = {
  trade_date: new Date().toISOString().slice(0, 10),
  symbol: "BTCUSDT",
  side: "long",
  entry_price: "",
  exit_price: "",
  quantity: "",
  fees: "",
  pnl: "",
  strategy: "",
  notes: "",
};

const cleanSymbol = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || "ACCOUNT";

const toNumber = (value) => {
  if (value == null || value === "") return null;
  const cleaned = String(value).replace(/[$,%\s"]/g, "").replace(/,/g, "");
  const sign = cleaned.startsWith("(") && cleaned.endsWith(")") ? -1 : 1;
  const normalized = cleaned.replace(/[()+]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number * sign : null;
};

const firstValue = (row, names) => {
  for (const name of names) {
    if (row[name] != null && row[name] !== "") return row[name];
  }
  return "";
};

export default function JournalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("trade_date", { ascending: false })
      .limit(150);
    setEntries(data || []);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const stats = useMemo(() => {
    const total = entries.reduce((sum, entry) => sum + Number(entry.pnl || 0), 0);
    const withPnl = entries.filter((entry) => entry.pnl != null);
    const wins = withPnl.filter((entry) => Number(entry.pnl) > 0).length;
    return {
      count: entries.length,
      total,
      winRate: withPnl.length ? (wins / withPnl.length) * 100 : 0,
    };
  }, [entries]);

  const weeklyReport = useMemo(() => buildWeeklyReport(entries), [entries]);

  const addEntry = async (event) => {
    event.preventDefault();
    setError("");
    const symbol = cleanSymbol(form.symbol);
    setSaving(true);
    const { error: insertError } = await supabase.from("journal_entries").insert({
      user_id: user.id,
      trade_date: new Date(form.trade_date).toISOString(),
      symbol,
      market: getMarketType(symbol),
      side: form.side,
      entry_price: toNumber(form.entry_price),
      exit_price: toNumber(form.exit_price),
      quantity: toNumber(form.quantity),
      fees: toNumber(form.fees) || 0,
      pnl: toNumber(form.pnl),
      strategy: form.strategy.trim(),
      notes: form.notes.trim(),
      source: "manual",
    });
    if (insertError) setError(insertError.message);
    else {
      setForm(emptyForm);
      await reload();
    }
    setSaving(false);
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const mapped = rows.map((row) => mapCsvRow(row, user.id)).filter(Boolean);
      if (!mapped.length) throw new Error("No rows found in CSV.");
      const { error: insertError } = await supabase.from("journal_entries").insert(mapped);
      if (insertError) throw insertError;
      await reload();
    } catch (err) {
      setError(err.message || "CSV import failed.");
    }
    event.target.value = "";
    setImporting(false);
  };

  const removeEntry = async (id) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    setEntries((items) => items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Workspace</div>
          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Journal</h1>
          <p className="text-sm text-zinc-500 mt-1.5">Manual trades and imported CSV records in one private ledger.</p>
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer">
          <FileUp className="w-4 h-4" strokeWidth={1.75} />
          {importing ? "Importing..." : "Import CSV"}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} disabled={importing} />
        </label>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Trades" value={stats.count.toLocaleString()} />
        <Stat label="Total P&L" value={`$${fmtPrice(stats.total, 2)}`} tone={stats.total >= 0 ? "bullish" : "bearish"} />
        <Stat label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden" data-testid="weekly-trader-report">
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Last 7 days</div>
            <div className="font-heading font-bold text-lg tracking-tight text-zinc-950 mt-0.5">Weekly Trader Report</div>
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">
            Discipline <span className="font-semibold text-zinc-950">{weeklyReport.disciplineScore}/100</span>
          </div>
        </div>
        <div className="grid lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100">
          <ReportStat label="Weekly trades" value={weeklyReport.count} detail={`${weeklyReport.documented} documented`} />
          <ReportStat
            label="Weekly P&L"
            value={`$${fmtPrice(weeklyReport.totalPnl, 2)}`}
            detail={weeklyReport.pnlChangeLabel}
            tone={weeklyReport.totalPnl >= 0 ? "bullish" : "bearish"}
          />
          <ReportStat label="Win rate" value={`${weeklyReport.winRate.toFixed(1)}%`} detail={weeklyReport.winRateChangeLabel} />
          <ReportStat label="Most traded" value={weeklyReport.topSymbol || "-"} detail={weeklyReport.topStrategy || "No strategy data"} />
        </div>
        <div className="grid md:grid-cols-2 border-t border-zinc-100">
          <div className="p-5 md:border-r border-zinc-100">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              <CheckCircle2 className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />
              Strongest habit
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed mt-2">{weeklyReport.strongestHabit}</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              <AlertTriangle className="w-4 h-4 text-zinc-600" strokeWidth={1.75} />
              Review focus
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed mt-2">{weeklyReport.reviewFocus}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
          New entry
        </div>
        <form onSubmit={addEntry} className="grid md:grid-cols-4 xl:grid-cols-8 gap-3 p-5" data-testid="journal-entry-form">
          <input type="date" value={form.trade_date} onChange={(event) => setForm({ ...form, trade_date: event.target.value })} className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <input value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })} placeholder="Symbol" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <select value={form.side} onChange={(event) => setForm({ ...form, side: event.target.value })} className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900">
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <input value={form.entry_price} onChange={(event) => setForm({ ...form, entry_price: event.target.value })} placeholder="Entry" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <input value={form.exit_price} onChange={(event) => setForm({ ...form, exit_price: event.target.value })} placeholder="Exit" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="Qty" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <input value={form.pnl} onChange={(event) => setForm({ ...form, pnl: event.target.value })} placeholder="P&L" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <button disabled={saving} className="inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-60">
            <Plus className="w-4 h-4" /> Add
          </button>
          <input value={form.fees} onChange={(event) => setForm({ ...form, fees: event.target.value })} placeholder="Fees" className="md:col-span-1 xl:col-span-2 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <input value={form.strategy} onChange={(event) => setForm({ ...form, strategy: event.target.value })} placeholder="Strategy" className="md:col-span-1 xl:col-span-2 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes" className="md:col-span-2 xl:col-span-4 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </form>
        {error && <div className="px-5 pb-4 text-xs text-rose-600">{error}</div>}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
          Entries
        </div>
        {entries.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-400">No journal entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  {["Date", "Symbol", "Side", "Entry", "Exit", "Qty", "Fees", "P&L", "Strategy", ""].map((head) => (
                    <th key={head} className="text-left px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors group">
                    <td className="px-5 py-3 text-xs text-zinc-500 tabular-nums">{fmtDate(entry.trade_date)}</td>
                    <td className="px-5 py-3 font-semibold tabular-nums text-sm text-zinc-950">{entry.symbol}</td>
                    <td className="px-5 py-3 text-sm text-zinc-700 capitalize">{entry.side}</td>
                    <td className="px-5 py-3 text-sm tabular-nums">{fmtPrice(entry.entry_price)}</td>
                    <td className="px-5 py-3 text-sm tabular-nums">{fmtPrice(entry.exit_price)}</td>
                    <td className="px-5 py-3 text-sm tabular-nums">{entry.quantity ?? "-"}</td>
                    <td className="px-5 py-3 text-sm tabular-nums">{fmtPrice(entry.fees, 2)}</td>
                    <td className={`px-5 py-3 text-sm tabular-nums font-semibold ${Number(entry.pnl || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {entry.pnl == null ? "-" : `$${fmtPrice(entry.pnl, 2)}`}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-700 max-w-[220px] truncate">{entry.strategy || entry.notes || "-"}</td>
                    <td className="px-2 py-3">
                      <button onClick={() => removeEntry(entry.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-600 transition-all" aria-label="Delete entry">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4">
      <div className="text-[11px] tracking-[0.08em] uppercase font-semibold text-zinc-500">{label}</div>
      <div className={`text-2xl font-heading font-bold tabular-nums tracking-tight mt-2 ${
        tone === "bullish" ? "text-emerald-600" : tone === "bearish" ? "text-rose-600" : "text-zinc-950"
      }`}>
        {value}
      </div>
    </div>
  );
}

function ReportStat({ label, value, detail, tone }) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.08em] uppercase font-semibold text-zinc-500">
        <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.75} />
        {label}
      </div>
      <div className={`text-xl font-heading font-bold tabular-nums tracking-tight mt-2 ${
        tone === "bullish" ? "text-emerald-600" : tone === "bearish" ? "text-rose-600" : "text-zinc-950"
      }`}>
        {value}
      </div>
      <div className="text-xs text-zinc-400 mt-1">{detail}</div>
    </div>
  );
}

function buildWeeklyReport(entries) {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const current = entries.filter((entry) => {
    const time = new Date(entry.trade_date || entry.created_at).getTime();
    return Number.isFinite(time) && time >= now - week;
  });
  const previous = entries.filter((entry) => {
    const time = new Date(entry.trade_date || entry.created_at).getTime();
    return Number.isFinite(time) && time >= now - week * 2 && time < now - week;
  });
  const currentWithPnl = current.filter((entry) => entry.pnl != null && Number.isFinite(Number(entry.pnl)));
  const previousWithPnl = previous.filter((entry) => entry.pnl != null && Number.isFinite(Number(entry.pnl)));
  const totalPnl = currentWithPnl.reduce((sum, entry) => sum + Number(entry.pnl), 0);
  const previousPnl = previousWithPnl.reduce((sum, entry) => sum + Number(entry.pnl), 0);
  const wins = currentWithPnl.filter((entry) => Number(entry.pnl) > 0).length;
  const previousWins = previousWithPnl.filter((entry) => Number(entry.pnl) > 0).length;
  const winRate = currentWithPnl.length ? (wins / currentWithPnl.length) * 100 : 0;
  const previousWinRate = previousWithPnl.length ? (previousWins / previousWithPnl.length) * 100 : 0;
  const documented = current.filter((entry) => String(entry.strategy || "").trim() && String(entry.notes || "").trim()).length;
  const documentationRate = current.length ? documented / current.length : 0;
  const disciplineScore = current.length
    ? Math.round(Math.min(100, 35 + documentationRate * 45 + Math.min(current.length, 10) * 2))
    : 0;
  const topSymbol = mostFrequent(current.map((entry) => entry.symbol).filter(Boolean));
  const topStrategy = mostFrequent(current.map((entry) => entry.strategy).filter(Boolean));
  const mistake = findFrequentMistake(current);

  const pnlDelta = totalPnl - previousPnl;
  const winRateDelta = winRate - previousWinRate;
  const strongestHabit = current.length === 0
    ? "Add trades during the week to build a personal performance report."
    : documentationRate >= 0.7
      ? `${Math.round(documentationRate * 100)}% of this week's trades include both strategy and notes.`
      : winRate >= 55
        ? `Execution converted ${winRate.toFixed(1)}% of recorded trades into wins.`
        : `${current.length} trades were captured, giving PBM more data for the next review.`;
  const reviewFocus = current.length === 0
    ? "No weekly trades yet. Start with one fully documented journal entry."
    : mistake
      ? `Review repeated "${mistake}" notes before the next session.`
      : documentationRate < 0.7
        ? "Add strategy and notes to every trade so discipline patterns become measurable."
        : totalPnl < 0
          ? "Review losing trades by setup and session before increasing risk."
          : "Keep the same documentation quality and review whether winners followed the original plan.";

  return {
    count: current.length,
    documented,
    totalPnl,
    winRate,
    disciplineScore,
    topSymbol,
    topStrategy,
    strongestHabit,
    reviewFocus,
    pnlChangeLabel: previous.length ? `${pnlDelta >= 0 ? "+" : ""}$${fmtPrice(pnlDelta, 2)} vs prior week` : "First measured week",
    winRateChangeLabel: previousWithPnl.length ? `${winRateDelta >= 0 ? "+" : ""}${winRateDelta.toFixed(1)} pts vs prior week` : "First measured week",
  };
}

function mostFrequent(values) {
  const counts = values.reduce((map, value) => {
    const key = String(value || "").trim();
    if (key) map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function findFrequentMistake(entries) {
  const labels = [
    ["early entry", /early entry|entered early/i],
    ["FOMO", /\bfomo\b|chased/i],
    ["revenge trade", /revenge/i],
    ["late entry", /late entry|entered late/i],
    ["stop too tight", /stop too tight|tight stop/i],
    ["no confirmation", /no confirmation|without confirmation/i],
    ["news volatility", /news|volatility/i],
  ];
  const notes = entries.map((entry) => `${entry.strategy || ""} ${entry.notes || ""}`).join("\n");
  return labels
    .map(([label, pattern]) => [label, (notes.match(new RegExp(pattern.source, "gi")) || []).length])
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count > 0)?.[0] || "";
}

function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function mapCsvRow(row, userId) {
  const rawSymbol = firstValue(row, ["Symbol", "symbol", "Instrument", "instrument", "Ticker", "ticker", "Account"]);
  const symbol = cleanSymbol(rawSymbol);
  const dateValue = firstValue(row, ["Date", "date", "Time", "time", "Opened", "Closed"]);
  const tradeDate = dateValue ? new Date(dateValue) : new Date();
  const pnl = firstValue(row, ["PnL", "P&L", "Closed P&L", "Day P&L", "Realized P&L", "Profit", "Net P&L"]);
  const quantity = firstValue(row, ["Qty", "Quantity", "Open Qty", "Size", "Contracts"]);
  return {
    user_id: userId,
    trade_date: Number.isNaN(tradeDate.getTime()) ? new Date().toISOString() : tradeDate.toISOString(),
    symbol,
    market: getMarketType(symbol),
    side: String(firstValue(row, ["Side", "side", "Direction"]) || "long").toLowerCase(),
    entry_price: toNumber(firstValue(row, ["Entry", "Entry Price", "Avg Entry", "Open Price"])),
    exit_price: toNumber(firstValue(row, ["Exit", "Exit Price", "Avg Exit", "Close Price"])),
    quantity: toNumber(quantity),
    fees: toNumber(firstValue(row, ["Fees", "Commission", "Commissions"])) || 0,
    pnl: toNumber(pnl),
    strategy: firstValue(row, ["Strategy", "Setup", "Playbook"]),
    notes: firstValue(row, ["Notes", "Status", "Comment"]),
    source: "csv",
  };
}
