// Market data — proxied through our FastAPI backend to bypass browser CORS.
// In production (Netlify), users may either:
//   - keep the FastAPI backend running and set REACT_APP_BACKEND_URL accordingly, or
//   - replace these endpoints with Netlify Functions / Supabase Edge Functions.
import { apiClient } from "@/lib/api";

export const TIMEFRAMES = [
  { id: "5m", label: "5m", binance: "5m" },
  { id: "15m", label: "15m", binance: "15m" },
  { id: "1h", label: "1h", binance: "1h" },
  { id: "4h", label: "4h", binance: "4h" },
  { id: "1d", label: "1D", binance: "1d" },
  { id: "1w", label: "1W", binance: "1w" },
];

// ---------- Crypto (Binance via backend proxy) ----------

export async function fetchKlines(symbol, interval = "1h", limit = 300) {
  const { data } = await apiClient.get("/market/klines", { params: { symbol, interval, limit } });
  return data.map((k) => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }));
}

export async function fetchTicker24h(symbol) {
  const { data: t } = await apiClient.get("/market/ticker24h", { params: { symbol } });
  return {
    symbol: t.symbol,
    last: parseFloat(t.lastPrice),
    open: parseFloat(t.openPrice),
    high: parseFloat(t.highPrice),
    low: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
    changePct: parseFloat(t.priceChangePercent),
  };
}

export async function fetchAllTickers(market = "crypto") {
  const { data } = await apiClient.get("/market/ticker24h", { params: { market } });
  return data;
}

// ---------- CoinGecko (via backend proxy) ----------

export async function fetchGlobal() {
  const { data } = await apiClient.get("/market/global");
  return data;
}

export async function searchCoinGecko(q) {
  if (!q) return [];
  try {
    const { data } = await apiClient.get("/market/search", { params: { q } });
    return (data.coins || []).slice(0, 10);
  } catch {
    return [];
  }
}

// ---------- Stocks via Alpha Vantage (optional, user key, called direct) ----------

export async function fetchStockSeries(symbol, apiKey, interval = "60min") {
  if (!apiKey) throw new Error("Alpha Vantage API key required for stocks");
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&outputsize=compact&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Alpha Vantage ${res.status}`);
  const data = await res.json();
  const key = Object.keys(data).find((k) => k.startsWith("Time Series"));
  if (!key) throw new Error(data.Note || data["Error Message"] || "No data");
  const series = data[key];
  return Object.entries(series)
    .map(([ts, row]) => ({
      t: new Date(ts + "Z").getTime(),
      o: parseFloat(row["1. open"]),
      h: parseFloat(row["2. high"]),
      l: parseFloat(row["3. low"]),
      c: parseFloat(row["4. close"]),
      v: parseFloat(row["5. volume"]),
    }))
    .reverse();
}

// ---------- Popular default symbols ----------

export const POPULAR_CRYPTO = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "ADAUSDT", "AVAXUSDT", "DOGEUSDT", "LINKUSDT", "MATICUSDT",
  "DOTUSDT", "ARBUSDT", "OPUSDT", "INJUSDT", "SUIUSDT",
];

export const POPULAR_FOREX = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURJPY",
];

export const POPULAR_INDICES = [
  "SPX", "NDX", "DJI", "IXIC", "RUT", "DAX", "FTSE", "N225",
];

export const MARKET_TABS = [
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "index", label: "Indices" },
];

export function popularForMarket(market) {
  if (market === "forex") return POPULAR_FOREX;
  if (market === "index") return POPULAR_INDICES;
  return POPULAR_CRYPTO;
}

const FOREX_CODES = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "TRY", "CNH", "SEK", "NOK", "DKK", "MXN", "ZAR"]);

export function getMarketType(symbol) {
  const clean = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 6 && FOREX_CODES.has(clean.slice(0, 3)) && FOREX_CODES.has(clean.slice(3, 6))) return "forex";
  if (POPULAR_INDICES.includes(clean) || ["SP500", "NASDAQ100", "DOW"].includes(clean)) return "index";
  return "crypto";
}

export function getMarketLabel(symbol) {
  const market = getMarketType(symbol);
  if (market === "forex") return "Forex";
  if (market === "index") return "Index";
  return "Crypto";
}

export function toTradingViewSymbol(symbol) {
  const clean = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const market = getMarketType(clean);
  if (market === "forex") return `FX:${clean}`;
  if (market === "index") {
    return {
      SPX: "SP:SPX",
      SP500: "SP:SPX",
      NDX: "NASDAQ:NDX",
      NASDAQ100: "NASDAQ:NDX",
      DJI: "DJ:DJI",
      DOW: "DJ:DJI",
      IXIC: "NASDAQ:IXIC",
      RUT: "TVC:RUT",
      DAX: "XETR:DAX",
      FTSE: "TVC:UKX",
      N225: "TVC:NI225",
    }[clean] || clean;
  }
  if (clean.endsWith("USDT")) return `BINANCE:${clean}`;
  return `BINANCE:${clean}USDT`;
}
