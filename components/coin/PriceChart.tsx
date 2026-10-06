"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { api } from "@/lib/api";
import { useWorldEvents } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/Skeleton";
import { SOL_USD } from "@/lib/format";
import type { Candle } from "@/types";

export function PriceChart({ mint }: { mint: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [loadedMint, setLoadedMint] = useState<string | null>(null);
  const loading = loadedMint !== mint;
  const [unit, setUnit] = useState<"usd" | "sol">("usd");
  const dataRef = useRef<Candle[]>([]);

  const toPoint = (c: Candle) => {
    const m = unit === "usd" ? SOL_USD * 1_000_000_000 : 1_000_000_000; // show market cap instead of raw 1e-8 prices
    return { time: c.time as UTCTimestamp, open: c.open * m, high: c.high * m, low: c.low * m, close: c.close * m };
  };

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ch = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a8a8a", fontFamily: "Inter, system-ui" },
      grid: { vertLines: { color: "#1c1c1c" }, horzLines: { color: "#1c1c1c" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#262626" },
      timeScale: { borderColor: "#262626", timeVisible: true, secondsVisible: false },
      autoSize: true,
      localization: {
        priceFormatter: (p: number) => (unit === "usd" ? "$" : "") + (p >= 1e6 ? (p / 1e6).toFixed(2) + "M" : p >= 1e3 ? (p / 1e3).toFixed(1) + "K" : p.toFixed(0)),
      },
    });
    const s = ch.addCandlestickSeries({
      upColor: "#22FF88",
      downColor: "#FF3B5C",
      borderUpColor: "#22FF88",
      borderDownColor: "#FF3B5C",
      wickUpColor: "#22FF88",
      wickDownColor: "#FF3B5C",
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    chart.current = ch;
    series.current = s;
    if (dataRef.current.length) {
      s.setData(dataRef.current.map(toPoint));
      ch.timeScale().fitContent();
    }
    return () => {
      ch.remove();
      chart.current = null;
      series.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  useEffect(() => {
    let alive = true;
    api.getCandles(mint).then((c) => {
      if (!alive) return;
      dataRef.current = c;
      series.current?.setData(c.map(toPoint));
      chart.current?.timeScale().fitContent();
      setLoadedMint(mint);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint]);

  useWorldEvents((e) => {
    if (e.type !== "coin" || e.coin.mint !== mint) return;
    api.getCandles(mint).then((c) => {
      dataRef.current = c;
      const last = c[c.length - 1];
      if (last && series.current) series.current.update(toPoint(last));
    });
  });

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="stat-label">Market cap · 5m candles</span>
        <div className="inline-flex rounded-md border border-line overflow-hidden text-[11px] font-bold">
          {(["usd", "sol"] as const).map((u) => (
            <button key={u} onClick={() => setUnit(u)} className={`px-2 h-6 ${unit === u ? "bg-gold text-black" : "text-muted hover:text-white"}`}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-72 sm:h-96">
        {loading && <Skeleton className="absolute inset-0" />}
        <div ref={ref} className="absolute inset-0" />
      </div>
    </div>
  );
}
