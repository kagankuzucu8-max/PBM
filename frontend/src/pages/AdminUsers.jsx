import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listAdminUsers, updateAdminUserAccess } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export default function AdminUsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setUsers(await listAdminUsers());
    } catch (loadError) {
      setError(loadError.response?.data?.detail || loadError.message || "Users could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredUsers = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return users;
    return users.filter((item) => String(item.email || "").toLowerCase().includes(clean));
  }, [query, users]);

  const updateFeature = async (user, field, enabled) => {
    if (user.role === "admin") return;
    setSavingEmail(user.email);
    setError("");
    const optimistic = { ...user, [field]: enabled };
    setUsers((items) => items.map((item) => (item.email === user.email ? optimistic : item)));
    try {
      const saved = await updateAdminUserAccess({
        email: user.email,
        can_use_ai_analysis: field === "can_use_ai_analysis" ? enabled : user.can_use_ai_analysis,
        can_use_pbm_brain: field === "can_use_pbm_brain" ? enabled : user.can_use_pbm_brain,
      });
      setUsers((items) => items.map((item) => (item.email === user.email ? { ...item, ...saved } : item)));
    } catch (saveError) {
      setUsers((items) => items.map((item) => (item.email === user.email ? user : item)));
      setError(saveError.response?.data?.detail || saveError.message || "User access could not be updated.");
    } finally {
      setSavingEmail("");
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6 max-w-5xl">
        <PageHeader />
        <div className="text-sm text-zinc-500">This panel is only available for PBM admins.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <PageHeader />
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-50"
          title="Refresh users"
          aria-label="Refresh users"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Users" value={users.length} />
        <Stat label="AI Analysis Enabled" value={users.filter((item) => item.can_use_ai_analysis).length} />
        <Stat label="PBM Brain Enabled" value={users.filter((item) => item.can_use_pbm_brain).length} />
      </div>

      {error && <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-md text-sm text-rose-700">{error}</div>}

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Feature access</div>
          <label className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </label>
        </div>

        {loading ? (
          <div className="px-5 py-20 text-center text-sm text-zinc-400">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-5 py-20 text-center text-sm text-zinc-400">No users found.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredUsers.map((item) => (
              <div key={item.email} className="px-5 py-4 grid lg:grid-cols-[1fr_190px_190px] gap-4 lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-950 truncate">{item.email}</div>
                    {item.role === "admin" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-600">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1 tabular-nums">
                    Joined {item.registered_at ? fmtDate(item.registered_at) : "PBM"}
                    {item.last_sign_in_at ? ` / Last sign-in ${fmtDate(item.last_sign_in_at)}` : ""}
                  </div>
                </div>
                <FeatureToggle
                  label="AI Analysis"
                  enabled={item.can_use_ai_analysis}
                  disabled={item.role === "admin" || savingEmail === item.email}
                  onChange={(enabled) => updateFeature(item, "can_use_ai_analysis", enabled)}
                />
                <FeatureToggle
                  label="PBM Brain"
                  enabled={item.can_use_pbm_brain}
                  disabled={item.role === "admin" || savingEmail === item.email}
                  onChange={(enabled) => updateFeature(item, "can_use_pbm_brain", enabled)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Administration</div>
      <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Users</h1>
      <p className="text-sm text-zinc-500 mt-1.5">Manage PBM feature access for each account.</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 min-h-[92px]">
      <div className="text-[11px] tracking-[0.08em] uppercase font-semibold text-zinc-500">{label}</div>
      <div className="text-2xl font-heading font-bold text-zinc-950 tabular-nums mt-2">{value}</div>
    </div>
  );
}

function FeatureToggle({ label, enabled, disabled, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-zinc-200 rounded-md px-3 py-2.5 bg-white">
      <span className="text-xs font-semibold text-zinc-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${label} ${enabled ? "enabled" : "disabled"}`}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-zinc-950" : "bg-zinc-200"
        }`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-[18px]" : "translate-x-0.5"
        }`} />
      </button>
    </div>
  );
}
