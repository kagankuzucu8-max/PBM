import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FileUp, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fmtDate, fmtPrice } from "@/lib/format";

const emptyAccount = {
  firm: "",
  account_name: "",
  account_size: "",
  challenge_phase: "",
  profit_target: "",
  max_daily_loss: "",
  max_loss: "",
  current_balance: "",
  next_payout_date: "",
  payout_amount: "",
  status: "active",
};

const emptyRecord = {
  payout_account_id: "",
  amount: "",
  status: "requested",
  notes: "",
};

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

export default function PayoutTrackerPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [records, setRecords] = useState([]);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [recordForm, setRecordForm] = useState(emptyRecord);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!user) return;
    const [{ data: accountRows }, { data: recordRows }] = await Promise.all([
      supabase.from("payout_accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("payout_records").select("*").eq("user_id", user.id).order("record_date", { ascending: false }).limit(80),
    ]);
    setAccounts(accountRows || []);
    setRecords(recordRows || []);
    if ((accountRows || []).length && !recordForm.payout_account_id) {
      setRecordForm((state) => ({ ...state, payout_account_id: accountRows[0].id }));
    }
  }, [recordForm.payout_account_id, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const stats = useMemo(() => {
    const balance = accounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0);
    const pending = accounts.reduce((sum, account) => sum + Number(account.payout_amount || 0), 0);
    const paid = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
    return { balance, pending, paid };
  }, [accounts, records]);

  const addAccount = async (event) => {
    event.preventDefault();
    setError("");
    setSavingAccount(true);
    const { error: insertError } = await supabase.from("payout_accounts").insert({
      user_id: user.id,
      firm: accountForm.firm.trim() || "Prop Firm",
      account_name: accountForm.account_name.trim(),
      account_size: toNumber(accountForm.account_size),
      challenge_phase: accountForm.challenge_phase.trim(),
      profit_target: toNumber(accountForm.profit_target),
      max_daily_loss: toNumber(accountForm.max_daily_loss),
      max_loss: toNumber(accountForm.max_loss),
      current_balance: toNumber(accountForm.current_balance),
      next_payout_date: accountForm.next_payout_date || null,
      payout_amount: toNumber(accountForm.payout_amount),
      status: accountForm.status,
    });
    if (insertError) setError(insertError.message);
    else {
      setAccountForm(emptyAccount);
      await reload();
    }
    setSavingAccount(false);
  };

  const addRecord = async (event) => {
    event.preventDefault();
    setError("");
    setSavingRecord(true);
    const { error: insertError } = await supabase.from("payout_records").insert({
      user_id: user.id,
      payout_account_id: recordForm.payout_account_id || null,
      amount: toNumber(recordForm.amount) || 0,
      status: recordForm.status,
      notes: recordForm.notes.trim(),
    });
    if (insertError) setError(insertError.message);
    else {
      setRecordForm({ ...emptyRecord, payout_account_id: accounts[0]?.id || "" });
      await reload();
    }
    setSavingRecord(false);
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setImporting(true);
    try {
      const rows = parseCsv(await file.text());
      const mapped = rows.map((row, index) => mapCsvRow(row, user.id, index)).filter(Boolean);
      if (!mapped.length) throw new Error("No rows found in CSV.");
      const { error: insertError } = await supabase.from("payout_accounts").insert(mapped);
      if (insertError) throw insertError;
      await reload();
    } catch (err) {
      setError(err.message || "CSV import failed.");
    }
    event.target.value = "";
    setImporting(false);
  };

  const deleteAccount = async (id) => {
    await supabase.from("payout_accounts").delete().eq("id", id);
    await reload();
  };

  const deleteRecord = async (id) => {
    await supabase.from("payout_records").delete().eq("id", id);
    setRecords((items) => items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Workspace</div>
          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Payout Tracker</h1>
          <p className="text-sm text-zinc-500 mt-1.5">Track funded accounts, drawdown limits, and payout requests.</p>
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer">
          <FileUp className="w-4 h-4" strokeWidth={1.75} />
          {importing ? "Importing..." : "Import CSV"}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} disabled={importing} />
        </label>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Current Balance" value={`$${fmtPrice(stats.balance, 2)}`} />
        <Stat label="Pending Payout" value={`$${fmtPrice(stats.pending, 2)}`} tone={stats.pending >= 0 ? "bullish" : "bearish"} />
        <Stat label="Recorded Payouts" value={`$${fmtPrice(stats.paid, 2)}`} />
      </div>

      <div className="grid xl:grid-cols-[1fr_420px] gap-5">
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
            Accounts
          </div>
          {accounts.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-400">No payout accounts yet.</div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4 p-5">
              {accounts.map((account) => (
                <article key={account.id} className="border border-zinc-200 rounded-lg bg-white p-4" data-testid={`payout-account-${account.firm}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-950">{account.firm}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{account.account_name || account.challenge_phase || "Funded account"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-zinc-100 text-zinc-700">
                        {account.status}
                      </span>
                      <button onClick={() => deleteAccount(account.id)} className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors" aria-label="Delete account">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-3 mt-5">
                    <Metric label="Account Size" value={money(account.account_size)} />
                    <Metric label="Balance" value={money(account.current_balance)} />
                    <Metric label="Profit Target" value={money(account.profit_target)} />
                    <Metric label="Max Loss" value={money(account.max_loss)} />
                    <Metric label="Daily Loss" value={money(account.max_daily_loss)} />
                    <Metric label="Payout" value={money(account.payout_amount)} />
                  </div>

                  <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                      <CalendarClock className="w-3.5 h-3.5" strokeWidth={1.75} />
                      {account.next_payout_date ? account.next_payout_date : "No date"}
                    </div>
                    {account.challenge_phase && <div className="text-xs text-zinc-500">{account.challenge_phase}</div>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              New account
            </div>
            <form onSubmit={addAccount} className="p-5 space-y-3" data-testid="payout-account-form">
              <div className="grid grid-cols-2 gap-3">
                <input value={accountForm.firm} onChange={(event) => setAccountForm({ ...accountForm, firm: event.target.value })} placeholder="Firm" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                <input value={accountForm.account_name} onChange={(event) => setAccountForm({ ...accountForm, account_name: event.target.value })} placeholder="Account" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={accountForm.account_size} onChange={(event) => setAccountForm({ ...accountForm, account_size: event.target.value })} placeholder="Size" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                <input value={accountForm.current_balance} onChange={(event) => setAccountForm({ ...accountForm, current_balance: event.target.value })} placeholder="Balance" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={accountForm.profit_target} onChange={(event) => setAccountForm({ ...accountForm, profit_target: event.target.value })} placeholder="Target" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                <input value={accountForm.payout_amount} onChange={(event) => setAccountForm({ ...accountForm, payout_amount: event.target.value })} placeholder="Payout" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={accountForm.max_daily_loss} onChange={(event) => setAccountForm({ ...accountForm, max_daily_loss: event.target.value })} placeholder="Daily loss" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                <input value={accountForm.max_loss} onChange={(event) => setAccountForm({ ...accountForm, max_loss: event.target.value })} placeholder="Max loss" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={accountForm.next_payout_date} onChange={(event) => setAccountForm({ ...accountForm, next_payout_date: event.target.value })} className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                <select value={accountForm.status} onChange={(event) => setAccountForm({ ...accountForm, status: event.target.value })} className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900">
                  <option value="active">Active</option>
                  <option value="passed">Passed</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <input value={accountForm.challenge_phase} onChange={(event) => setAccountForm({ ...accountForm, challenge_phase: event.target.value })} placeholder="Phase" className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              <button disabled={savingAccount} className="w-full inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium h-10 hover:bg-zinc-800 transition-colors disabled:opacity-60">
                <Plus className="w-4 h-4" /> Add account
              </button>
            </form>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              Payout record
            </div>
            <form onSubmit={addRecord} className="p-5 space-y-3" data-testid="payout-record-form">
              <select value={recordForm.payout_account_id} onChange={(event) => setRecordForm({ ...recordForm, payout_account_id: event.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="">No account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.firm} {account.account_name || ""}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input value={recordForm.amount} onChange={(event) => setRecordForm({ ...recordForm, amount: event.target.value })} placeholder="Amount" className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                <select value={recordForm.status} onChange={(event) => setRecordForm({ ...recordForm, status: event.target.value })} className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900">
                  <option value="requested">Requested</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <input value={recordForm.notes} onChange={(event) => setRecordForm({ ...recordForm, notes: event.target.value })} placeholder="Notes" className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              <button disabled={savingRecord} className="w-full inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium h-10 hover:bg-zinc-800 transition-colors disabled:opacity-60">
                <Plus className="w-4 h-4" /> Add record
              </button>
            </form>
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
          Records
        </div>
        {records.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-400">No payout records yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {records.map((record) => {
              const account = accounts.find((item) => item.id === record.payout_account_id);
              return (
                <li key={record.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-zinc-50 transition-colors group">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950">{money(record.amount)}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{account?.firm || "No account"} / {record.status}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-zinc-400 tabular-nums hidden sm:block">{fmtDate(record.record_date)}</div>
                    <button onClick={() => deleteRecord(record.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-600 transition-all" aria-label="Delete record">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
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

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-400">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-zinc-950 mt-1">{value}</div>
    </div>
  );
}

function money(value) {
  return value == null ? "-" : `$${fmtPrice(value, 2)}`;
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

function mapCsvRow(row, userId, index) {
  const hasValue = Object.values(row).some((value) => String(value || "").trim());
  if (!hasValue) return null;
  const balance = firstValue(row, ["Balance", "Current Balance", "current_balance"]);
  const payout = firstValue(row, ["Payout", "Payout Amount", "Closed P&L", "Day P&L", "Profit"]);
  const accountName = firstValue(row, ["Account", "Account Name", "Login", "Name"]) || `Account ${index + 1}`;
  return {
    user_id: userId,
    firm: firstValue(row, ["Firm", "Prop Firm", "Broker"]) || "Imported",
    account_name: accountName,
    account_size: toNumber(firstValue(row, ["Account Size", "Size"])),
    challenge_phase: firstValue(row, ["Phase", "Challenge Phase", "Program"]),
    profit_target: toNumber(firstValue(row, ["Profit Target", "Target"])),
    max_daily_loss: toNumber(firstValue(row, ["Max Daily Loss", "Daily Loss"])),
    max_loss: toNumber(firstValue(row, ["Max Loss", "Loss Limit", "EOD Drawdown"])),
    current_balance: toNumber(balance),
    next_payout_date: firstValue(row, ["Next Payout Date", "Payout Date"]) || null,
    payout_amount: toNumber(payout),
    status: String(firstValue(row, ["Status"]) || "active").toLowerCase(),
  };
}
