"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useNow, useWorldEvents } from "@/lib/hooks";
import { fmtSol, shortAddr } from "@/lib/format";
import type { Trade } from "@/types";

const stamp = (ts: number) => {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
};

/** The biggest buys of the last 24h, printed like an intercepted log. */
export function Intercepts({ limit = 9 }: { limit?: number }) {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const now = useNow(5000);
  useEffect(() => {
    api.getMoneyPrinter(limit).then(setTrades);
  }, [limit]);
  useWorldEvents((e) => {
    if (e.type !== "trade" || e.trade.side !== "buy") return;
    setTrades((prev) => [e.trade, ...(prev ?? [])].sort((a, b) => b.sol - a.sol).slice(0, limit));
  });
  const max = Math.max(1, ...(trades ?? []).map((t) => t.sol));

  return (
    <div className="card h-full flex flex-col bg-black/40">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em]">
        <span className="text-gold">{"// intercepted buys"}</span>
        <span className="text-muted">24h</span>
      </div>
      <div className="flex-1 p-2 font-mono text-[12px] leading-none">
        {!trades ? (
          <div className="p-2 text-muted cursor">listening</div>
        ) : trades.length === 0 ? (
          <div className="p-3 text-muted space-y-2">
            <div>{stamp(now)} no traffic on the curve</div>
            <div className="cursor">waiting for the first buy</div>
          </div>
        ) : (
          <ul>
            {trades.map((t, i) => (
              <li key={t.id} className="animate-slide-in" style={{ animationDelay: `${i * 40}ms` }}>
                <Link href={`/coin/${t.mint}`} className="relative flex items-center gap-3 h-9 px-2 hover:bg-white/5 overflow-hidden">
                  <span className="absolute left-0 top-0 bottom-0 bg-gold/10" style={{ width: `${(t.sol / max) * 100}%` }} />
                  <span className="relative text-muted">{stamp(t.ts)}</span>
                  <span className="relative text-muted hidden sm:inline">{shortAddr(t.wallet, 3)}</span>
                  <span className="relative text-muted">→</span>
                  <span className="relative text-white font-bold truncate">${t.ticker}</span>
                  <span className="relative flex-1" />
                  <span className="relative text-gold font-bold tabular">+{fmtSol(t.sol, 2)} SOL</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
