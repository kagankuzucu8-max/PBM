"""Backend API tests for MarketDesk AI.

Tests cover:
- /api/health
- /api/market/ticker24h (single + list)
- /api/market/klines
- /api/market/global
- /api/analyze (real Claude call via Emergent LLM key — may take 5-15s)
- /api/chat
- CORS headers
- Symbol mapping (BTCUSDT, ETHUSDT, SOLUSDT)
- Error handling
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trading-hub-360.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Health ----------
class TestHealth:
    def test_health(self, client):
        r = client.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["service"] == "marketdesk-ai"
        assert "model" in data


# ---------- Market data ----------
class TestMarketTicker:
    def test_ticker_btc(self, client):
        r = client.get(f"{API}/market/ticker24h", params={"symbol": "BTCUSDT"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["symbol"] == "BTCUSDT"
        for k in ("lastPrice", "highPrice", "lowPrice", "openPrice", "volume", "priceChangePercent"):
            assert k in d
        assert float(d["lastPrice"]) > 0

    def test_ticker_eth(self, client):
        r = client.get(f"{API}/market/ticker24h", params={"symbol": "ETHUSDT"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["symbol"] == "ETHUSDT"
        assert float(r.json()["lastPrice"]) > 0

    def test_ticker_sol(self, client):
        r = client.get(f"{API}/market/ticker24h", params={"symbol": "SOLUSDT"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["symbol"] == "SOLUSDT"

    def test_ticker_all(self, client):
        r = client.get(f"{API}/market/ticker24h", timeout=30)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) > 50
        # Confirm BTCUSDT exists
        syms = [t["symbol"] for t in arr]
        assert "BTCUSDT" in syms

    def test_ticker_invalid_symbol(self, client):
        r = client.get(f"{API}/market/ticker24h", params={"symbol": "FAKECOINUSDT"}, timeout=20)
        # OKX returns success with empty data => server raises 404
        assert r.status_code in (400, 404, 502)


class TestKlines:
    def test_klines_btc_1h(self, client):
        r = client.get(f"{API}/market/klines", params={"symbol": "BTCUSDT", "interval": "1h", "limit": 50}, timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) > 0
        first = arr[0]
        # [openTime, o, h, l, c, v, closeTime, quoteVol, trades]
        assert len(first) >= 6
        assert isinstance(first[0], int)
        # ordered oldest to newest
        assert arr[0][0] < arr[-1][0]

    def test_klines_eth_15m(self, client):
        r = client.get(f"{API}/market/klines", params={"symbol": "ETHUSDT", "interval": "15m", "limit": 20}, timeout=20)
        assert r.status_code == 200
        assert len(r.json()) > 0


class TestGlobal:
    def test_global(self, client):
        r = client.get(f"{API}/market/global", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "total_market_cap" in d
        assert "usd" in d["total_market_cap"]
        assert d["total_market_cap"]["usd"] > 0
        assert "market_cap_percentage" in d
        assert d["market_cap_percentage"]["btc"] is not None
        assert "active_cryptocurrencies" in d


# ---------- CORS ----------
class TestCORS:
    def test_cors_allows_origin(self, client):
        origin = "https://trading-hub-360.preview.emergentagent.com"
        r = client.options(
            f"{API}/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
            timeout=15,
        )
        # CORS preflight should succeed
        assert r.status_code in (200, 204)
        # Allow-origin should be * or echo origin
        allow = r.headers.get("access-control-allow-origin", "")
        assert allow == "*" or origin in allow


# ---------- Analyze (real AI) ----------
class TestAnalyze:
    def test_analyze_btc(self, client):
        payload = {
            "symbol": "BTCUSDT",
            "market": "crypto",
            "timeframe": "1h",
            "current_price": 65000.0,
            "change_24h": 2.5,
            "indicators": {
                "rsi": 58.4,
                "macd": 120.5,
                "macd_signal": 95.1,
                "macd_hist": 25.4,
                "ema20": 64500.0,
                "ema50": 63200.0,
                "ema200": 60000.0,
                "bb_upper": 66000.0,
                "bb_middle": 64500.0,
                "bb_lower": 63000.0,
                "adx": 28.0,
                "atr": 350.0,
            },
            "candles": [
                {"t": 1700000000000 + i * 3600000, "o": 64000 + i * 10, "h": 64100 + i * 10,
                 "l": 63900 + i * 10, "c": 64050 + i * 10, "v": 100 + i}
                for i in range(30)
            ],
            "user_context": "Quick read please.",
        }
        r = client.post(f"{API}/analyze", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["symbol"] == "BTCUSDT"
        assert d["verdict"] in ("strong_buy", "buy", "neutral", "sell", "strong_sell")
        assert 0.0 <= d["confidence"] <= 1.0
        assert isinstance(d["summary"], str) and len(d["summary"]) > 0
        assert isinstance(d["patterns"], list)
        assert "support" in d["key_levels"] and "resistance" in d["key_levels"]
        assert -100 <= d["technical_score"] <= 100
        assert -100 <= d["ai_score"] <= 100
        assert -100 <= d["combined_score"] <= 100
        assert "id" in d


# ---------- Chat ----------
class TestChat:
    def test_chat_basic(self, client):
        payload = {
            "session_id": "TEST_session_001",
            "symbol": "BTCUSDT",
            "message": "In one sentence, what should I watch for on BTC right now?",
        }
        r = client.post(f"{API}/chat", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"] == "TEST_session_001"
        assert isinstance(d["reply"], str)
        assert len(d["reply"]) > 0
