import React, { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, AreaSeries } from "lightweight-charts";

/**
 * Lightweight Charts wrapper.
 * Props: candles [{t, o, h, l, c, v}], height, mode "candles" | "area".
 */
export default function PriceChart({ candles, height = 380, mode = "candles" }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      height,
      localization: { locale: "en-US" },
      layout: {
        background: { type: "solid", color: "#ffffff" },
        textColor: "#52525b",
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(228,228,231,0.6)" },
        horzLines: { color: "rgba(228,228,231,0.6)" },
      },
      rightPriceScale: { borderColor: "#e4e4e7" },
      timeScale: { borderColor: "#e4e4e7", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;
    seriesRef.current = null;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!chartRef.current || !candles || candles.length === 0) return;
    // (re)create series when mode changes
    if (seriesRef.current) {
      try { chartRef.current.removeSeries(seriesRef.current); } catch (e) { /* noop */ }
      seriesRef.current = null;
    }
    if (mode === "candles") {
      seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: "#16A34A",
        downColor: "#E11D48",
        borderUpColor: "#16A34A",
        borderDownColor: "#E11D48",
        wickUpColor: "#16A34A",
        wickDownColor: "#E11D48",
      });
      seriesRef.current.setData(
        candles.map((c) => ({
          time: Math.floor(c.t / 1000),
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
        }))
      );
    } else {
      seriesRef.current = chartRef.current.addSeries(AreaSeries, {
        lineColor: "#09090B",
        topColor: "rgba(9,9,11,0.18)",
        bottomColor: "rgba(9,9,11,0.0)",
        lineWidth: 2,
      });
      seriesRef.current.setData(
        candles.map((c) => ({ time: Math.floor(c.t / 1000), value: c.c }))
      );
    }
    chartRef.current.timeScale().fitContent();
  }, [candles, mode]);

  return <div ref={containerRef} data-testid="price-chart" className="w-full" />;
}
