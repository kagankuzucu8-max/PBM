// Formatting helpers for prices, percentages, dates.

export function fmtPrice(v, digits) {
  if (v == null || isNaN(v)) return "—";
  if (digits != null) return Number(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const abs = Math.abs(v);
  let d = 2;
  if (abs < 0.01) d = 6;
  else if (abs < 1) d = 4;
  else if (abs < 100) d = 3;
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPct(v, digits = 2) {
  if (v == null || isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${Number(v).toFixed(digits)}%`;
}

export function fmtVol(v) {
  if (v == null || isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(2);
}

export function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function verdictLabel(v) {
  return {
    strong_buy: "Strong Buy",
    buy: "Buy",
    neutral: "Neutral",
    sell: "Sell",
    strong_sell: "Strong Sell",
  }[v] || "Neutral";
}

export function verdictTone(v) {
  if (v === "strong_buy" || v === "buy") return "bullish";
  if (v === "strong_sell" || v === "sell") return "bearish";
  return "neutral";
}
