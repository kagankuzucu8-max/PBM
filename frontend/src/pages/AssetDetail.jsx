import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, BookmarkPlus, BookmarkCheck, BarChart3, CandlestickChart, Maximize2, Minimize2 } from "lucide-react";
import PriceChart from "@/components/PriceChart";
import TradingViewChart from "@/components/TradingViewChart";
import TechnicalPanel from "@/components/TechnicalPanel";
import AIAnalysisPanel from "@/components/AIAnalysisPanel";
import { fetchKlines, fetchTicker24h, TIMEFRAMES, getMarketLabel, getMarketType } from "@/lib/market";
import { computeIndicators, quickVerdict } from "@/lib/indicators";
import { analyzeAsset } from "@/lib/api";
import { fmtPrice, fmtPct, fmtVol, fmtDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { buildAnalysisChange } from "@/lib/analysisChange";

export default function AssetDetail() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const { user, aiUsage, isAdmin, access, refreshAccount } = useAuth();
  const aiAnalysisEnabled = isAdmin || access?.can_use_ai_analysis !== false;
  const [timeframe, setTimeframe] = useState(localStorage.getItem("md.tf") || "1h");
  const [candles, setCandles] = useState([]);
  const [ticker, setTicker] = useState(null);
  const [chartMode, setChartMode] = useState("candles");
  const [chartSource, setChartSource] = useState(localStorage.getItem("md.chart_source") || "pbm");
  const [analysis, setAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [watchlists, setWatchlists] = useState([]);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [previousAnalysis, setPreviousAnalysis] = useState(null);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState(540);
  const chartBodyRef = useRef(null);

  useEffect(() => {
    refreshAccount().catch(() => {});
  }, [refreshAccount]);

  useEffect(() => {
    if (!chartFullscreen) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [chartFullscreen]);

  useEffect(() => {
    if (!chartBodyRef.current) return undefined;
    const updateHeight = () => {
      const next = Math.max(320, chartBodyRef.current.clientHeight - 16);
      setChartHeight(next);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(chartBodyRef.current);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [chartFullscreen]);

  // Load OHLC + ticker
  useEffect(() => {
    let alive = true;
    const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[2];
    setAnalysis(null); // invalidate previous analysis when timeframe changes
    Promise.all([
      fetchKlines(symbol, tf.binance, 300),
      fetchTicker24h(symbol),
    ])
      .then(([k, t]) => { if (alive) { setCandles(k); setTicker(t); } })
      .catch((e) => console.error(e));
    return () => { alive = false; };
  }, [symbol, timeframe]);

  // Live ticker refresh
  useEffect(() => {
    const id = setInterval(() => {
      fetchTicker24h(symbol).then(setTicker).catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [symbol]);

  // Load user's watchlists
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: lists } = await supabase.from("watchlists").select("id,name").eq("user_id", user.id);
      setWatchlists(lists || []);
      if (lists && lists.length > 0) {
        const { data: items } = await supabase
          .from("watchlist_items")
          .select("id")
          .eq("user_id", user.id)
          .eq("symbol", symbol)
          .limit(1);
        setInWatchlist((items || []).length > 0);
      }
    })();
  }, [user, symbol]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setPreviousAnalysis(null);
    supabase
      .from("analysis_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (alive) setPreviousAnalysis(data?.[0] || null);
      });
    return () => {
      alive = false;
    };
  }, [user, symbol, timeframe]);

  const indicators = useMemo(() => computeIndicators(candles), [candles]);
  const marketType = useMemo(() => getMarketType(symbol), [symbol]);
  const marketLabel = useMemo(() => getMarketLabel(symbol), [symbol]);
  const marketHeader = `${marketLabel} · Yahoo`;
  const verdict = useMemo(
    () => indicators ? quickVerdict(indicators.snapshot, ticker?.last) : { score: 0, label: "neutral" },
    [indicators, ticker]
  );

  const runAnalysis = useCallback(async () => {
    if (!aiAnalysisEnabled || !ticker || !indicators) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const payload = {
        symbol,
        market: marketType,
        timeframe,
        current_price: ticker.last,
        change_24h: ticker.changePct,
        indicators: indicators.snapshot,
        candles: candles.slice(-60),
        bypass_cache: Boolean(analysis),
      };
      const res = await analyzeAsset(payload);
      const changeTracking = buildAnalysisChange(analysis || previousAnalysis, res);
      const analysisWithChange = changeTracking ? { ...res, change_tracking: changeTracking } : res;
      setAnalysis(analysisWithChange);
      setLastUpdated(new Date().toLocaleString());
      if (res.usage) refreshAccount().catch(() => {});
      // Save to Supabase history
      if (user) {
        await supabase.from("analysis_history").insert({
          user_id: user.id,
          symbol,
          market: marketType,
          timeframe,
          verdict: res.verdict,
          combined_score: res.combined_score,
          summary: res.summary,
          payload: analysisWithChange,
        });
        setPreviousAnalysis({
          symbol,
          timeframe,
          verdict: res.verdict,
          combined_score: res.combined_score,
          summary: res.summary,
          payload: analysisWithChange,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      setAiError(e.response?.data?.detail || e.message || "Analysis failed");
    } finally {
      setAiLoading(false);
    }
  }, [aiAnalysisEnabled, symbol, timeframe, ticker, indicators, candles, analysis, previousAnalysis, user, marketType, refreshAccount]);

  const toggleWatchlist = async () => {
    if (!user || watchlists.length === 0) {
      navigate("/watchlists");
      return;
    }
    const wl = watchlists[0];
    if (inWatchlist) {
      await supabase.from("watchlist_items").delete().eq("user_id", user.id).eq("symbol", symbol);
      setInWatchlist(false);
    } else {
      await supabase.from("watchlist_items").insert({
        watchlist_id: wl.id,
        user_id: user.id,
        symbol,
        market: marketType,
      });
      setInWatchlist(true);
    }
  };

  const ch = ticker?.changePct;
  const positive = (ch || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate(-1)} data-testid="asset-back-btn" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors mt-2">
            ← Back
          </button>
          <div>
            <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">{marketHeader}</div>
            <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1" data-testid="asset-symbol">{symbol}</h1>
            <div className="flex items-baseline gap-3 mt-1.5">
              <div className="text-3xl font-medium tabular-nums text-zinc-900" data-testid="asset-price">
                {ticker ? fmtPrice(ticker.last) : "—"}
              </div>
              {ch != null && (
                <div className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${positive ? "text-emerald-600" : "text-rose-600"}`} data-testid="asset-change">
                  {positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {fmtPct(ch)} <span className="text-zinc-500 font-normal ml-1">24h</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 tabular-nums">
              {ticker && <span>H: {fmtPrice(ticker.high)}</span>}
              {ticker && <span>L: {fmtPrice(ticker.low)}</span>}
              {ticker && <span>Vol: {fmtVol(ticker.quoteVolume)}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleWatchlist}
            data-testid="toggle-watchlist-btn"
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium border transition-colors ${
              inWatchlist
                ? "bg-zinc-950 text-white border-zinc-950 hover:bg-zinc-800"
                : "bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {inWatchlist ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
            {inWatchlist ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {/* Chart controls */}
      <div className={`bg-white border border-zinc-200 overflow-hidden ${
        chartFullscreen ? "fixed inset-0 z-[80] rounded-none flex flex-col" : "rounded-lg"
      }`}>
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-zinc-50 rounded-md p-0.5">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTimeframe(t.id); localStorage.setItem("md.tf", t.id); }}
                data-testid={`tf-${t.id}`}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  timeframe === t.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-zinc-50 rounded-md p-0.5">
              {["pbm", "tradingview"].map((source) => (
                <button
                  key={source}
                  onClick={() => { setChartSource(source); localStorage.setItem("md.chart_source", source); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                    chartSource === source ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {source === "pbm" ? "PBM" : "TradingView"}
                </button>
              ))}
            </div>
            {chartSource === "pbm" && (
              <div className="flex items-center gap-1 bg-zinc-50 rounded-md p-0.5">
                <button
                  onClick={() => setChartMode("candles")}
                  data-testid="chart-mode-candles"
                  className={`p-1.5 rounded transition-colors ${chartMode === "candles" ? "bg-white shadow-sm" : "hover:bg-zinc-100"}`}
                  aria-label="Candlestick"
                >
                  <CandlestickChart className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setChartMode("area")}
                  data-testid="chart-mode-area"
                  className={`p-1.5 rounded transition-colors ${chartMode === "area" ? "bg-white shadow-sm" : "hover:bg-zinc-100"}`}
                  aria-label="Area"
                >
                  <BarChart3 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setChartFullscreen((current) => !current)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
              aria-label={chartFullscreen ? "Exit full screen chart" : "Open full screen chart"}
              title={chartFullscreen ? "Exit full screen" : "Full screen"}
              data-testid="chart-fullscreen"
            >
              {chartFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div
          ref={chartBodyRef}
          className={`p-2 ${chartFullscreen ? "flex-1 min-h-0" : "h-[500px] md:h-[560px]"}`}
        >
          {chartSource === "tradingview" ? (
            <TradingViewChart symbol={symbol} timeframe={timeframe} height={chartHeight} />
          ) : (
            <PriceChart candles={candles} mode={chartMode} height={chartHeight} />
          )}
        </div>
      </div>

      {/* Tech + AI panels */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2">
          <TechnicalPanel
            snapshot={indicators?.snapshot}
            price={ticker?.last}
            quickScore={verdict.score}
            quickLabel={verdict.label}
          />
        </div>
        <div className="lg:col-span-3">
          <AIAnalysisPanel
            analysis={analysis}
            loading={aiLoading}
            error={aiError}
            onRun={runAnalysis}
            lastUpdated={lastUpdated}
            usage={analysis?.usage || aiUsage}
            isAdmin={isAdmin}
            enabled={aiAnalysisEnabled}
          />
        </div>
      </div>
    </div>
  );
}
