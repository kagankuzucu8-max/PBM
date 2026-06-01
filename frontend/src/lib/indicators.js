// Technical indicators computed in the browser using `technicalindicators`.
import { RSI, MACD, BollingerBands, EMA, SMA, ATR, ADX, Stochastic } from "technicalindicators";

const last = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);

export function computeIndicators(candles) {
  if (!candles || candles.length < 30) return null;
  const close = candles.map((c) => c.c);
  const high = candles.map((c) => c.h);
  const low = candles.map((c) => c.l);

  const rsi = RSI.calculate({ values: close, period: 14 });
  const macd = MACD.calculate({
    values: close,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const bb = BollingerBands.calculate({ values: close, period: 20, stdDev: 2 });
  const ema20 = EMA.calculate({ values: close, period: 20 });
  const ema50 = EMA.calculate({ values: close, period: 50 });
  const ema200 = close.length >= 200 ? EMA.calculate({ values: close, period: 200 }) : [];
  const sma20 = SMA.calculate({ values: close, period: 20 });
  const sma50 = SMA.calculate({ values: close, period: 50 });
  const atr = ATR.calculate({ high, low, close, period: 14 });
  const adx = ADX.calculate({ high, low, close, period: 14 });
  const stoch = Stochastic.calculate({ high, low, close, period: 14, signalPeriod: 3 });

  const lastMacd = last(macd) || {};
  const lastBB = last(bb) || {};
  const lastStoch = last(stoch) || {};
  const lastAdx = last(adx) || {};

  return {
    series: { rsi, macd, bb, ema20, ema50, ema200, sma20, sma50, atr, adx, stoch },
    snapshot: {
      rsi: last(rsi),
      macd: lastMacd.MACD,
      macd_signal: lastMacd.signal,
      macd_hist: lastMacd.histogram,
      bb_upper: lastBB.upper,
      bb_middle: lastBB.middle,
      bb_lower: lastBB.lower,
      ema20: last(ema20),
      ema50: last(ema50),
      ema200: last(ema200),
      sma20: last(sma20),
      sma50: last(sma50),
      atr: last(atr),
      adx: lastAdx.adx,
      stoch_k: lastStoch.k,
      stoch_d: lastStoch.d,
    },
  };
}

// Heuristic technical verdict for the panel even before AI runs.
export function quickVerdict(snap, price) {
  if (!snap) return { score: 0, label: "neutral" };
  let score = 0;
  let n = 0;
  if (snap.rsi != null) {
    n++;
    if (snap.rsi < 30) score += 1.5;
    else if (snap.rsi > 70) score -= 1.5;
    else score += (50 - snap.rsi) / 40;
  }
  if (snap.macd != null && snap.macd_signal != null) {
    n++;
    score += snap.macd > snap.macd_signal ? 1 : -1;
  }
  if (snap.ema20 != null && snap.ema50 != null) {
    n++;
    score += snap.ema20 > snap.ema50 ? 0.8 : -0.8;
  }
  if (snap.ema50 != null && snap.ema200 != null) {
    n++;
    score += snap.ema50 > snap.ema200 ? 0.6 : -0.6;
  }
  if (snap.bb_upper != null && snap.bb_lower != null && price != null) {
    n++;
    if (price > snap.bb_upper) score -= 0.6;
    else if (price < snap.bb_lower) score += 0.6;
  }
  const norm = n === 0 ? 0 : score / n;
  const pct = Math.max(Math.min(norm * 60, 100), -100);
  let label = "neutral";
  if (pct >= 50) label = "strong_buy";
  else if (pct >= 20) label = "buy";
  else if (pct <= -50) label = "strong_sell";
  else if (pct <= -20) label = "sell";
  return { score: pct, label };
}
