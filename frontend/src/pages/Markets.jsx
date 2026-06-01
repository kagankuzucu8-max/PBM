import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import SymbolSearch from "@/components/SymbolSearch";
import { fetchAllTickers, MARKET_TABS } from "@/lib/market";
import { fmtPrice, fmtPct, fmtVol } from "@/lib/format";

const SORTS = [
  { id: "volume", label: "Volume" },
  { id: "gain", label: "% Gain" },
  { id: "loss", label: "% Loss" },
  { id: "price", label: "Price" },
];

export default function Markets() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const market = params.get("market") || "crypto";
  const [rows, setRows] = useState([]);
  const [sort, setSort] = useState("volume");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const all = await fetchAllTickers(market);
        if (!alive) return;
        const filtered = market === "crypto"
          ? all.filter((t) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 1_000_000)
          : all;
        setRows(filtered);
      } catch (e) { /* noop */ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(id); };
  }, [market]);

  const sorted = useMemo(() => {
    let r = [...rows];
    if (filter) r = r.filter((t) => t.symbol.includes(filter.toUpperCase()));
    if (sort === "volume") r.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
    else if (sort === "gain") r.sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));
    else if (sort === "loss") r.sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent));
    else if (sort === "price") r.sort((a, b) => parseFloat(b.lastPrice) - parseFloat(a.lastPrice));
    return r.slice(0, 100);
  }, [rows, sort, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Screener</div>
          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Markets</h1>
          <p className="text-sm text-zinc-500 mt-1.5">Live markets across crypto, forex, and indices. Click a row to open the chart.</p>
        </div>
        <div className="w-full sm:w-80">
          <SymbolSearch />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-zinc-50 rounded-md p-0.5">
            {MARKET_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setParams({ market: tab.id })}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  market === tab.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-zinc-50 rounded-md p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                data-testid={`sort-${s.id}`}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  sort === s.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter symbol (e.g. BTC)"
            data-testid="markets-filter"
            className="flex-1 max-w-xs px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <div className="text-xs text-zinc-400 ml-auto">{sorted.length} results</div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="text-left px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Symbol</th>
              <th className="text-right px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Price</th>
              <th className="text-right px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">24h %</th>
              <th className="text-right px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">High</th>
              <th className="text-right px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Low</th>
              <th className="text-right px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Volume</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const ch = parseFloat(t.priceChangePercent);
              return (
                <tr
                  key={t.symbol}
                  onClick={() => navigate(`/asset/${t.symbol}`)}
                  data-testid={`market-row-${t.symbol}`}
                  className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 font-semibold tabular-nums text-sm text-zinc-950">{t.symbol}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-sm">{fmtPrice(parseFloat(t.lastPrice))}</td>
                  <td className={`px-5 py-3 text-right tabular-nums text-sm font-medium ${ch >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    <span className="inline-flex items-center gap-1">
                      {ch >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {fmtPct(ch)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-sm text-zinc-600">{fmtPrice(parseFloat(t.highPrice))}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-sm text-zinc-600">{fmtPrice(parseFloat(t.lowPrice))}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-sm text-zinc-600">{fmtVol(parseFloat(t.quoteVolume))}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-zinc-400">Loading markets…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
