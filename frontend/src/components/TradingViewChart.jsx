import React, { useMemo } from "react";
import { toTradingViewSymbol } from "@/lib/market";

const intervalMap = {
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

export default function TradingViewChart({ symbol, timeframe = "1h", height = 380 }) {
  const src = useMemo(() => {
    const params = new URLSearchParams({
      symbol: toTradingViewSymbol(symbol),
      interval: intervalMap[timeframe] || "60",
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      withdateranges: "1",
      hide_side_toolbar: "0",
      allow_symbol_change: "0",
      save_image: "0",
      studies: "Volume@tv-basicstudies",
      support_host: "https://www.tradingview.com",
    });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [symbol, timeframe]);

  return (
    <iframe
      key={src}
      title={`${symbol} TradingView chart`}
      src={src}
      data-testid="tradingview-chart"
      className="w-full border-0"
      style={{ height }}
      allowTransparency="true"
      scrolling="no"
      allowFullScreen
    />
  );
}
