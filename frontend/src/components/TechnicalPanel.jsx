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

export default function TechnicalPanel({ snapshot, price, quickScore, quickLabel }) {
  if (!snapshot) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <div className="text-sm text-zinc-500">Loading indicators…</div>
      </div>
    );
  }

  const score = quickScore || 0;
  const scoreColor = score >= 20 ? "text-emerald-600" : score <= -20 ? "text-rose-600" : "text-zinc-700";
  const labelMap = {
    strong_buy: { text: "Strong Buy", bg: "bg-emerald-100", color: "text-emerald-700" },
    buy: { text: "Buy", bg: "bg-emerald-50", color: "text-emerald-600" },
    neutral: { text: "Neutral", bg: "bg-zinc-100", color: "text-zinc-600" },
    sell: { text: "Sell", bg: "bg-rose-50", color: "text-rose-600" },
    strong_sell: { text: "Strong Sell", bg: "bg-rose-100", color: "text-rose-700" },
  }[quickLabel || "neutral"];

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Technical Engine</div>
          <div className="text-lg font-heading font-bold tracking-tight text-zinc-950 mt-0.5">Indicator Snapshot</div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${labelMap.bg} ${labelMap.color}`} data-testid="tech-verdict">
          {labelMap.text} <span className={`ml-1 tabular-nums ${scoreColor}`}>{score.toFixed(0)}</span>
        </div>
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
