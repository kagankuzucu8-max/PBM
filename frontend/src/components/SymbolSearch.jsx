import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { POPULAR_CRYPTO, POPULAR_FOREX, POPULAR_INDICES, getMarketLabel, getMarketType } from "@/lib/market";
import { useNavigate } from "react-router-dom";

export default function SymbolSearch({ placeholder = "Search symbol (e.g. BTC, ETH, SOL)…", autoFocus, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const term = q.trim().toUpperCase();
  const matches = (() => {
    if (!term) return POPULAR_CRYPTO.slice(0, 8);
    const universe = [...POPULAR_CRYPTO, ...POPULAR_FOREX, ...POPULAR_INDICES];
    const fromList = universe.filter((s) => s.includes(term));
    const synthetic = getMarketType(term) === "crypto" && !term.endsWith("USDT") ? `${term}USDT` : term;
    const ordered = fromList.some((s) => getMarketType(s) !== "crypto")
      ? [...fromList, synthetic]
      : [synthetic, ...fromList];
    return [...new Set(ordered)].slice(0, 8);
  })();

  const pick = (sym) => {
    setOpen(false);
    setQ("");
    if (onPick) onPick(sym);
    else navigate(`/asset/${sym}`);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" strokeWidth={1.75} />
        <input
          value={q}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) pick(matches[0]); }}
          placeholder={placeholder}
          data-testid="symbol-search-input"
          className="w-full pl-10 pr-9 py-2.5 bg-white border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            aria-label="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-md shadow-lg overflow-hidden" data-testid="symbol-search-dropdown">
          {matches.map((s) => (
            <button
              key={s}
              onClick={() => pick(s)}
              data-testid={`symbol-option-${s}`}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors"
            >
              <span className="font-semibold tabular-nums text-zinc-950">{s}</span>
              <span className="text-xs text-zinc-500">{getMarketLabel(s)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
