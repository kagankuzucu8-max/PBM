import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Activity, BarChart3, Database, X } from "lucide-react";
import SymbolSearch from "@/components/SymbolSearch";
import { fetchAllTickers, fetchGlobal, MARKET_TABS, popularForMarket } from "@/lib/market";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fmtPrice, fmtPct, fmtVol } from "@/lib/format";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickers, setTickers] = useState({});
  const [movers, setMovers] = useState({ gainers: [], losers: [] });
  const [global, setGlobal] = useState(null);
  const [assetMarket, setAssetMarket] = useState("crypto");
  const [watchSyms, setWatchSyms] = useState([]);
  const [dbReady, setDbReady] = useState(true);
  const [dismissedSetup, setDismissedSetup] = useState(
    localStorage.getItem("md.dismissed_setup") === "1"
  );

  useEffect(() => {
    fetchGlobal().then(setGlobal).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const all = await fetchAllTickers(assetMarket);
        if (!alive) return;
        const map = {};
        all.forEach((t) => { map[t.symbol] = t; });
        setTickers(map);
        const rows = all
          .filter((t) => assetMarket !== "crypto" || (t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 5_000_000))
          .map((t) => ({ ...t, changePct: parseFloat(t.priceChangePercent) }));
        const sorted = [...rows].sort((a, b) => b.changePct - a.changePct);
        setMovers({ gainers: sorted.slice(0, 6), losers: sorted.slice(-6).reverse() });
      } catch (e) { /* noop */ }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [assetMarket]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: lists, error } = await supabase.from("watchlists").select("id").eq("user_id", user.id);
      if (error && error.code === "PGRST205") { setDbReady(false); return; }
      if (!lists || lists.length === 0) { setWatchSyms([]); return; }
      const ids = lists.map((l) => l.id);
      const { data: items } = await supabase.from("watchlist_items").select("symbol").in("watchlist_id", ids).limit(8);
      setWatchSyms((items || []).map((i) => i.symbol));
    })();
  }, [user]);

  return (
    <div className="space-y-8">
      {!dbReady && !dismissedSetup && (
        <div className="relative bg-amber-50 border border-amber-200 rounded-lg p-4 pr-12" data-testid="setup-banner">
          <button
            onClick={() => { localStorage.setItem("md.dismissed_setup", "1"); setDismissedSetup(true); }}
            className="absolute top-3 right-3 text-amber-700 hover:text-amber-900"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-900">One-time Supabase setup needed</div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Watchlists, alerts, and history won't save until tables exist. Open Supabase → SQL Editor → paste the schema
                from <code className="px-1 py-0.5 bg-amber-100 rounded text-[11px]">/app/supabase/schema.sql</code> → Run.
                Market data, charts, indicators, and AI analysis already work without this step.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Overview</div>
          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Market Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1.5">Live snapshot of the crypto market and your watchlist.</p>
        </div>
        <div className="w-full sm:w-96">
          <SymbolSearch />
        </div>
      </div>

      {global && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={BarChart3}
            label="Total Market Cap"
            value={"$" + fmtVol(global.total_market_cap?.usd)}
            sub={fmtPct(global.market_cap_change_percentage_24h_usd)}
            tone={(global.market_cap_change_percentage_24h_usd || 0) >= 0 ? "bullish" : "bearish"}
          />
          <StatCard
            icon={Activity}
            label="24h Volume"
            value={"$" + fmtVol(global.total_volume?.usd)}
            sub={`Active: ${global.active_cryptocurrencies?.toLocaleString()}`}
          />
          <StatCard
            label="BTC Dominance"
            value={`${(global.market_cap_percentage?.btc || 0).toFixed(2)}%`}
            sub={`ETH: ${(global.market_cap_percentage?.eth || 0).toFixed(2)}%`}
          />
          <StatCard
            label="Markets"
            value={global.markets?.toLocaleString()}
            sub={`Exchanges: ${global.markets ? Math.round(global.markets / 100) : "—"}+`}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="Top Gainers (24h)" testid="top-gainers">
          <MoverList items={movers.gainers} tone="bullish" onPick={(s) => navigate(`/asset/${s}`)} />
        </Panel>
        <Panel title="Top Losers (24h)" testid="top-losers">
          <MoverList items={movers.losers} tone="bearish" onPick={(s) => navigate(`/asset/${s}`)} />
        </Panel>
        <Panel title="Your Watchlist" testid="your-watchlist">
          {(watchSyms.length === 0) ? (
            <div className="text-sm text-zinc-500 py-8 px-4 text-center">
              No symbols yet.
              <button onClick={() => navigate("/watchlists")} className="block mx-auto mt-2 text-xs font-semibold text-zinc-950 hover:underline" data-testid="empty-watchlist-cta">
                Build your watchlist →
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {watchSyms.map((s) => {
                const t = tickers[s];
                const ch = t ? parseFloat(t.priceChangePercent) : null;
                return (
                  <li key={s}>
                    <button
                      onClick={() => navigate(`/asset/${s}`)}
                      data-testid={`watchlist-row-${s}`}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="font-semibold tabular-nums text-zinc-950 text-sm">{s}</div>
                      <div className="text-right">
                        <div className="text-sm tabular-nums text-zinc-900">{t ? fmtPrice(parseFloat(t.lastPrice)) : "—"}</div>
                        {ch != null && (
                          <div className={`text-xs tabular-nums ${ch >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtPct(ch)}</div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Popular Assets"
        testid="popular-assets"
        action={(
          <div className="flex items-center gap-1 bg-zinc-50 rounded-md p-0.5">
            {MARKET_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAssetMarket(tab.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                  assetMarket === tab.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
          {popularForMarket(assetMarket).map((s) => {
            const t = tickers[s];
            const ch = t ? parseFloat(t.priceChangePercent) : null;
            return (
              <button
                key={s}
                onClick={() => navigate(`/asset/${s}`)}
                data-testid={`popular-${s}`}
                className="text-left p-3 border border-zinc-200 rounded-md hover:border-zinc-400 hover:bg-zinc-50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold tabular-nums text-zinc-950 text-sm">{s.replace("USDT", "")}</div>
                  {ch != null && (ch >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />)}
                </div>
                <div className="text-base font-medium tabular-nums text-zinc-900 mt-1">{t ? fmtPrice(parseFloat(t.lastPrice)) : "—"}</div>
                {ch != null && <div className={`text-xs tabular-nums mt-0.5 ${ch >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtPct(ch)}</div>}
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function StatCard({ label, value, sub, tone, icon: Icon }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] tracking-[0.08em] uppercase font-semibold text-zinc-500">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />}
      </div>
      <div className="text-2xl font-heading font-bold tabular-nums text-zinc-950 tracking-tight">{value}</div>
      {sub && (
        <div className={`text-xs tabular-nums mt-1 ${tone === "bullish" ? "text-emerald-600" : tone === "bearish" ? "text-rose-600" : "text-zinc-500"}`}>{sub}</div>
      )}
    </div>
  );
}

function Panel({ title, children, testid, action }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden" data-testid={testid}>
      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-3">
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">{title}</div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function MoverList({ items, tone, onPick }) {
  if (!items.length) {
    return <div className="px-4 py-10 text-center text-sm text-zinc-400">Loading…</div>;
  }
  return (
    <ul className="divide-y divide-zinc-100">
      {items.map((t) => {
        const ch = parseFloat(t.priceChangePercent);
        return (
          <li key={t.symbol}>
            <button
              onClick={() => onPick(t.symbol)}
              data-testid={`mover-${t.symbol}`}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="font-semibold tabular-nums text-zinc-950 text-sm">{t.symbol.replace("USDT", "")}</div>
                <div className="text-[10px] text-zinc-400 tabular-nums">{fmtVol(parseFloat(t.quoteVolume))}</div>
              </div>
              <div className={`text-sm font-semibold tabular-nums ${tone === "bullish" ? "text-emerald-600" : "text-rose-600"}`}>
                {fmtPct(ch)}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
