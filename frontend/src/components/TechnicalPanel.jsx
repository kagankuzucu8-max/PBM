import React from "react";
import { fmtPrice } from "@/lib/format";

function Gauge({ label, value, min = 0, max = 100, lowThresh, highThresh, format = (v) => v?.toFixed(2) }) {
  const pct = value == null ? 0 : ((value - min) / (max - min)) * 100;
  const clamped = Math.max(0, Math.min(100, pct));
  let tone = "neutral";
  if (lowThresh != null && value != null && value < lowThresh) tone = "bullish"; // oversold -> bullish
  if (highThresh != null && value != null && value > highThresh) tone = "bearish";

  const toneColor = {
    bullish: "bg-emerald-500",
    bearish: "bg-rose-500",
    neutral: "bg-zinc-700",
  }[tone];

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] tracking-[0.06em] uppercase font-semibold text-zinc-500">{label}</div>
        <div className="text-sm font-medium tabular-nums text-zinc-900" data-testid={`indicator-${label.toLowerCase()}`}>
          {value == null ? "—" : format(value)}
        </div>
      </div>
      <div className="relative h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${toneColor} transition-all duration-300`}
          style={{ width: `${clamped}%` }}
        />
        {lowThresh != null && (
          <div
            className="absolute top-0 h-full w-px bg-zinc-300"
            style={{ left: `${((lowThresh - min) / (max - min)) * 100}%` }}
          />
        )}
        {highThresh != null && (
          <div
            className="absolute top-0 h-full w-px bg-zinc-300"
            style={{ left: `${((highThresh - min) / (max - min)) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, value, secondary }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <div className="text-[11px] tracking-[0.06em] uppercase font-semibold text-zinc-500">{label}</div>
      <div className="text-right">
        <div className="text-sm font-medium tabular-nums text-zinc-900">{value}</div>
        {secondary && <div className="text-[11px] text-zinc-500 tabular-nums">{secondary}</div>}
      </div>
    </div>
  );
}

function TechnicalHeatBar({ score, label }) {
  const clampedScore = Math.max(-100, Math.min(100, Number(score) || 0));
  const position = (clampedScore + 100) / 2;
  const displayScore = Math.round(clampedScore);
  const displayLabel = {
    strong_buy: "Strong Buy",
    buy: "Buy",
    neutral: "Neutral",
    sell: "Sell",
    strong_sell: "Strong Sell",
  }[label || "neutral"];
  const tooltip = `${displayLabel} ${displayScore > 0 ? "+" : ""}${displayScore}`;

  return (
    <button
      type="button"
      className="relative group shrink-0 py-3 focus:outline-none"
      aria-label={`Technical score: ${tooltip}`}
      title={tooltip}
      data-testid="tech-verdict"
    >
      <span
        className="block relative w-28 sm:w-32 h-2 rounded-full border border-zinc-200"
        style={{ background: "linear-gradient(90deg, #e11d48 0%, #f4f4f5 50%, #10b981 100%)" }}
      >
        <span
          className="absolute top-1/2 w-3 h-3 rounded-full bg-white border-2 border-zinc-900 shadow-sm -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300"
          style={{ left: `${position}%` }}
        />
      </span>
      <span className="pointer-events-none absolute right-0 top-full z-20 whitespace-nowrap rounded bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        {tooltip}
      </span>
    </button>
  );
}

export default function TechnicalPanel({ snapshot, price, quickScore, quickLabel }) {
  if (!snapshot) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <div className="text-sm text-zinc-500">Loading indicators…</div>
      </div>
    );
  }

  const score = quickScore || 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Technical Engine</div>
          <div className="text-lg font-heading font-bold tracking-tight text-zinc-950 mt-0.5">Indicator Snapshot</div>
        </div>
        <TechnicalHeatBar score={score} label={quickLabel} />
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <Gauge label="RSI 14" value={snapshot.rsi} lowThresh={30} highThresh={70} />
        <Gauge label="Stoch %K" value={snapshot.stoch_k} lowThresh={20} highThresh={80} />
        <Gauge label="ADX" value={snapshot.adx} min={0} max={60} format={(v) => v.toFixed(1)} />
        <Gauge label="MACD Hist" value={snapshot.macd_hist} min={-Math.abs(snapshot.macd_hist || 1) * 2 - 0.01} max={Math.abs(snapshot.macd_hist || 1) * 2 + 0.01} format={(v) => v.toFixed(4)} />
      </div>
      <div className="px-6 pb-6 grid grid-cols-2 gap-x-8 gap-y-1 border-t border-zinc-100 pt-4">
        <MetricRow label="EMA 20" value={fmtPrice(snapshot.ema20)} secondary={snapshot.ema50 ? `vs EMA50: ${snapshot.ema20 > snapshot.ema50 ? "↑" : "↓"}` : null} />
        <MetricRow label="EMA 50" value={fmtPrice(snapshot.ema50)} />
        <MetricRow label="EMA 200" value={fmtPrice(snapshot.ema200)} />
        <MetricRow label="SMA 20" value={fmtPrice(snapshot.sma20)} />
        <MetricRow label="BB Upper" value={fmtPrice(snapshot.bb_upper)} />
        <MetricRow label="BB Lower" value={fmtPrice(snapshot.bb_lower)} />
        <MetricRow label="ATR 14" value={fmtPrice(snapshot.atr)} />
        <MetricRow label="MACD" value={snapshot.macd != null ? snapshot.macd.toFixed(4) : "—"} secondary={snapshot.macd_signal != null ? `sig ${snapshot.macd_signal.toFixed(4)}` : null} />
      </div>
    </div>
  );
}
