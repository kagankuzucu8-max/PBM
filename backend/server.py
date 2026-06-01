"""MarketDesk AI Trading Analysis Backend.

A minimal FastAPI service that exposes AI-powered market analysis endpoints
backed by Claude Sonnet 4.5 (via Emergent Universal LLM Key).

Persistence (watchlists, alerts, history) lives in Supabase and is written
directly from the React frontend. This backend is stateless and focuses
exclusively on the AI analysis engine, so it can later be ported to a
Supabase Edge Function with minimal changes.
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
if not EMERGENT_LLM_KEY:
    raise RuntimeError("EMERGENT_LLM_KEY missing from environment")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("marketdesk")

app = FastAPI(title="MarketDesk AI", version="1.0.0")
api = APIRouter(prefix="/api")


# ---------- Schemas ----------

class IndicatorSnapshot(BaseModel):
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    ema20: Optional[float] = None
    ema50: Optional[float] = None
    ema200: Optional[float] = None
    sma20: Optional[float] = None
    sma50: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    stoch_k: Optional[float] = None
    stoch_d: Optional[float] = None
    atr: Optional[float] = None
    adx: Optional[float] = None


class Candle(BaseModel):
    t: int  # epoch ms
    o: float
    h: float
    l: float
    c: float
    v: float


class AnalyzeRequest(BaseModel):
    symbol: str
    market: str = Field(default="crypto", description="crypto | stock | forex")
    timeframe: str = Field(default="1h")
    current_price: float
    change_24h: Optional[float] = None
    indicators: IndicatorSnapshot
    candles: List[Candle] = Field(default_factory=list, description="Last N candles, oldest -> newest")
    user_context: Optional[str] = None


class DetectedPattern(BaseModel):
    name: str
    direction: str  # bullish | bearish | neutral
    confidence: float  # 0..1
    description: str


class AnalyzeResponse(BaseModel):
    id: str
    symbol: str
    verdict: str  # strong_buy | buy | neutral | sell | strong_sell
    confidence: float  # 0..1
    summary: str
    trend: str  # uptrend | downtrend | sideways
    short_term_outlook: str
    medium_term_outlook: str
    patterns: List[DetectedPattern]
    key_levels: dict  # {support: [], resistance: []}
    risk_notes: str
    technical_score: float  # -100..100 (bearish..bullish), derived from indicators
    ai_score: float  # -100..100 from AI verdict
    combined_score: float


class ChatRequest(BaseModel):
    session_id: str
    symbol: Optional[str] = None
    context: Optional[dict] = None
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str


# ---------- Helpers ----------

def technical_score_from_indicators(ind: IndicatorSnapshot, price: float) -> float:
    """Heuristic composite score in [-100, 100]."""
    score = 0.0
    weight = 0.0

    if ind.rsi is not None:
        weight += 1
        if ind.rsi < 30:
            score += 80  # oversold -> bullish bias
        elif ind.rsi > 70:
            score -= 80  # overbought -> bearish bias
        else:
            score += (50 - ind.rsi) * -2  # 50=0, 30=+40, 70=-40

    if ind.macd is not None and ind.macd_signal is not None:
        weight += 1
        diff = ind.macd - ind.macd_signal
        score += max(min(diff * 200, 60), -60)

    if ind.ema20 is not None and ind.ema50 is not None:
        weight += 1
        score += 40 if ind.ema20 > ind.ema50 else -40

    if ind.ema50 is not None and ind.ema200 is not None:
        weight += 1
        score += 30 if ind.ema50 > ind.ema200 else -30

    if ind.bb_upper is not None and ind.bb_lower is not None:
        weight += 1
        if price > ind.bb_upper:
            score -= 30
        elif price < ind.bb_lower:
            score += 30

    if ind.adx is not None and ind.adx > 25:
        # strengthens whatever direction we already have
        score *= 1.1

    if weight == 0:
        return 0.0
    # normalize roughly
    return max(min(score / max(weight, 1) * 1.2, 100), -100)


def verdict_from_score(score: float) -> str:
    if score >= 60:
        return "strong_buy"
    if score >= 25:
        return "buy"
    if score <= -60:
        return "strong_sell"
    if score <= -25:
        return "sell"
    return "neutral"


def build_system_prompt(market: str) -> str:
    return (
        "You are MarketDesk AI, a senior quantitative analyst specializing in "
        f"{market} markets. You explain technical setups crisply and never "
        "give blanket financial advice. You consider RSI, MACD, EMAs, Bollinger "
        "Bands, ADX, ATR, volume, and recent price action together. "
        "You MUST respond with ONLY valid JSON, no markdown fences, no prose outside JSON. "
        "Schema strictly: {"
        '"verdict": "strong_buy|buy|neutral|sell|strong_sell", '
        '"confidence": 0..1, '
        '"summary": "2-3 sentence executive summary", '
        '"trend": "uptrend|downtrend|sideways", '
        '"short_term_outlook": "1-2 sentences about next few hours/days", '
        '"medium_term_outlook": "1-2 sentences about next 1-4 weeks", '
        '"patterns": [{"name": "string", "direction": "bullish|bearish|neutral", "confidence": 0..1, "description": "short"}], '
        '"key_levels": {"support": [num, num], "resistance": [num, num]}, '
        '"risk_notes": "1-2 sentences about invalidation / risk"'
        "}"
    )


def build_user_prompt(req: AnalyzeRequest, tech_score: float) -> str:
    ind = req.indicators.model_dump()
    last_n = req.candles[-30:] if req.candles else []
    candle_compact = [
        f"{c.t},{c.o:.4f},{c.h:.4f},{c.l:.4f},{c.c:.4f},{c.v:.2f}" for c in last_n
    ]
    return (
        f"Symbol: {req.symbol} ({req.market}) | timeframe: {req.timeframe}\n"
        f"Current price: {req.current_price}\n"
        f"24h change: {req.change_24h}\n"
        f"Heuristic composite tech score (engine pre-compute, range -100..100): {tech_score:.1f}\n"
        f"Indicators: {json.dumps({k: v for k, v in ind.items() if v is not None})}\n"
        f"Last {len(candle_compact)} candles (t,o,h,l,c,v):\n" + "\n".join(candle_compact) +
        (f"\nUser note: {req.user_context}" if req.user_context else "") +
        "\n\nReturn ONLY the JSON object."
    )


JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def parse_ai_json(raw: str) -> dict:
    raw = raw.strip()
    m = JSON_FENCE_RE.search(raw)
    if m:
        raw = m.group(1)
    # find first { and last }
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object in AI response: {raw[:200]}")
    return json.loads(raw[start : end + 1])


async def call_claude(session_id: str, system_prompt: str, user_text: str) -> str:
    chat = (
        LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt,
        )
        .with_model("anthropic", "claude-sonnet-4-5-20250929")
        .with_params(max_tokens=2000)
    )
    reply = await chat.send_message(UserMessage(text=user_text))
    return reply


# ---------- Routes ----------

@api.get("/health")
async def health():
    return {"status": "ok", "service": "marketdesk-ai", "model": "claude-sonnet-4-5"}


# -------- Market data proxy (avoids browser CORS + uses unrestricted exchanges) --------
# Primary: OKX SPOT (works from this region). Returns Binance-compatible shape so
# the frontend remains agnostic of the data source.

OKX = "https://www.okx.com"
COINPAPRIKA = "https://api.coinpaprika.com/v1"
COINGECKO = "https://api.coingecko.com/api/v3"

_http_client: Optional[httpx.AsyncClient] = None


async def get_http() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=15.0, headers={"User-Agent": "MarketDesk/1.0"})
    return _http_client


# UI symbol "BTCUSDT" -> OKX "BTC-USDT".
QUOTES = ("USDT", "USDC", "USD", "BTC", "ETH", "BNB", "EUR", "TRY", "BRL")


def to_okx_symbol(symbol: str) -> str:
    s = symbol.upper().replace("-", "")
    for q in QUOTES:
        if s.endswith(q) and len(s) > len(q):
            return f"{s[:-len(q)]}-{q}"
    return s


def from_okx_symbol(inst_id: str) -> str:
    return inst_id.replace("-", "")


def map_okx_interval(tf: str) -> str:
    tf = tf.lower()
    # OKX uses lowercase for minute, uppercase for hour/day/week.
    return {
        "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
        "1h": "1H", "2h": "2H", "4h": "4H", "6h": "6H", "12h": "12H",
        "1d": "1D", "1w": "1W", "1mo": "1M",
    }.get(tf, "1H")


def okx_ticker_to_binance_shape(t: dict) -> dict:
    last = float(t.get("last", 0) or 0)
    open24 = float(t.get("open24h", 0) or 0)
    change_pct = ((last - open24) / open24 * 100.0) if open24 else 0.0
    vol_base = float(t.get("vol24h", 0) or 0)
    vol_quote = float(t.get("volCcy24h", 0) or 0)
    # OKX docs: for SPOT, vol24h is base ccy volume, volCcy24h is quote ccy volume.
    return {
        "symbol": from_okx_symbol(t.get("instId", "")),
        "lastPrice": str(last),
        "openPrice": str(open24),
        "highPrice": str(t.get("high24h", 0)),
        "lowPrice": str(t.get("low24h", 0)),
        "volume": str(vol_base),
        "quoteVolume": str(vol_quote),
        "priceChangePercent": f"{change_pct:.4f}",
    }


@api.get("/market/klines")
async def market_klines(symbol: str, interval: str = "1h", limit: int = 300):
    client = await get_http()
    inst = to_okx_symbol(symbol)
    bar = map_okx_interval(interval)
    r = await client.get(
        f"{OKX}/api/v5/market/candles",
        params={"instId": inst, "bar": bar, "limit": min(limit, 300)},
    )
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    body = r.json()
    if str(body.get("code")) != "0":
        raise HTTPException(status_code=400, detail=body.get("msg", "OKX error"))
    rows = body.get("data", [])
    # OKX returns newest first; we want oldest first.
    rows = list(reversed(rows))
    # Convert to Binance-compatible kline array
    # Binance kline: [openTime, open, high, low, close, volume, closeTime, quoteAssetVol, trades, ...]
    out = []
    for k in rows:
        # k = [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
        t = int(k[0])
        out.append([t, k[1], k[2], k[3], k[4], k[5], t, k[7] if len(k) > 7 else "0", 0])
    return out


@api.get("/market/ticker24h")
async def market_ticker24h(symbol: Optional[str] = None):
    client = await get_http()
    if symbol:
        r = await client.get(f"{OKX}/api/v5/market/ticker", params={"instId": to_okx_symbol(symbol)})
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        body = r.json()
        data = body.get("data", [])
        if not data:
            raise HTTPException(status_code=404, detail="Symbol not found")
        return okx_ticker_to_binance_shape(data[0])
    r = await client.get(f"{OKX}/api/v5/market/tickers", params={"instType": "SPOT"})
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    body = r.json()
    data = body.get("data", [])
    return [okx_ticker_to_binance_shape(t) for t in data]


@api.get("/market/global")
async def market_global():
    """Global crypto stats. Uses CoinPaprika (works everywhere, no key)."""
    client = await get_http()
    r = await client.get(f"{COINPAPRIKA}/global")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    p = r.json()
    return {
        "total_market_cap": {"usd": p.get("market_cap_usd")},
        "total_volume": {"usd": p.get("volume_24h_usd")},
        "market_cap_percentage": {
            "btc": p.get("bitcoin_dominance_percentage"),
            "eth": p.get("ethereum_dominance_percentage"),
        },
        "market_cap_change_percentage_24h_usd": p.get("market_cap_change_24h"),
        "active_cryptocurrencies": p.get("cryptocurrencies_number"),
        "markets": p.get("markets_number"),
    }


@api.get("/market/search")
async def market_search(q: str = Query(..., min_length=1)):
    client = await get_http()
    try:
        r = await client.get(f"{COINGECKO}/search", params={"query": q})
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {"coins": []}


@api.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    tech_score = technical_score_from_indicators(req.indicators, req.current_price)
    analysis_id = str(uuid.uuid4())

    try:
        raw = await call_claude(
            session_id=f"analyze-{analysis_id}",
            system_prompt=build_system_prompt(req.market),
            user_text=build_user_prompt(req, tech_score),
        )
        logger.info("Claude raw reply length=%d", len(raw))
        data = parse_ai_json(raw)
    except Exception as e:  # pragma: no cover - safety net
        logger.exception("AI analysis failed")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    # Derive AI score from verdict
    verdict_map = {
        "strong_buy": 80,
        "buy": 40,
        "neutral": 0,
        "sell": -40,
        "strong_sell": -80,
    }
    ai_verdict = data.get("verdict", "neutral")
    ai_score = verdict_map.get(ai_verdict, 0) * float(data.get("confidence", 0.6))
    combined = (tech_score * 0.45) + (ai_score * 0.55)
    final_verdict = verdict_from_score(combined)

    patterns_raw = data.get("patterns", []) or []
    patterns = []
    for p in patterns_raw[:6]:
        try:
            patterns.append(
                DetectedPattern(
                    name=str(p.get("name", "pattern"))[:80],
                    direction=str(p.get("direction", "neutral")),
                    confidence=float(p.get("confidence", 0.5)),
                    description=str(p.get("description", ""))[:300],
                )
            )
        except Exception:
            continue

    key_levels = data.get("key_levels") or {}
    if not isinstance(key_levels, dict):
        key_levels = {}
    key_levels.setdefault("support", [])
    key_levels.setdefault("resistance", [])

    return AnalyzeResponse(
        id=analysis_id,
        symbol=req.symbol,
        verdict=final_verdict,
        confidence=float(data.get("confidence", 0.65)),
        summary=str(data.get("summary", ""))[:600],
        trend=str(data.get("trend", "sideways")),
        short_term_outlook=str(data.get("short_term_outlook", ""))[:400],
        medium_term_outlook=str(data.get("medium_term_outlook", ""))[:400],
        patterns=patterns,
        key_levels=key_levels,
        risk_notes=str(data.get("risk_notes", ""))[:400],
        technical_score=round(tech_score, 2),
        ai_score=round(ai_score, 2),
        combined_score=round(combined, 2),
    )


@api.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    system = (
        "You are MarketDesk AI, a concise quantitative trading copilot. "
        "Answer in the user's language. Keep replies under 200 words unless a chart or list helps. "
        "Never fabricate exact prices you don't have; use the provided context. "
        "Always remind that this is not financial advice when giving directional opinions."
    )
    context_text = ""
    if req.context:
        context_text = "\nContext: " + json.dumps(req.context)[:1500]
    if req.symbol:
        context_text = f"\nSymbol: {req.symbol}" + context_text

    try:
        reply = await call_claude(
            session_id=req.session_id,
            system_prompt=system,
            user_text=req.message + context_text,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chat failed: {e}")

    return ChatResponse(session_id=req.session_id, reply=reply.strip())


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
