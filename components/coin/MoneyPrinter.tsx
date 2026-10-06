"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTick, useWorldEvents } from "@/lib/hooks";
import { RowSkeleton } from "@/components/ui/Skeleton";
import { fmtSol, shortAddr, timeAgo } from "@/lib/format";
import type { Trade } from "@/types";

export function MoneyPrinter({ limit = 9 }: { limit?: number }) {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [emoji, setEmoji] = useState<Record<string, string>>({});
  useTick(5000);

  useEffect(() => {
    api.getMoneyPrinter(limit).then(setTrades);
  }, [limit]);

  useWorldEvents((e) => {
    if (e.type === "live" && e.event.kind === "buy") setEmoji((m) => ({ ...m, [e.event.mint]: e.event.emoji }));
    if (e.type !== "trade" || e.trade.side !== "buy") return;
    setTrades((prev) => {
      const list = [e.trade, ...(prev ?? [])];
      // Keep the biggest buys of the last window, but let fresh big ones in
      return list.sort((a, b) => b.sol - a.sol).slice(0, limit);
    });
  });

  const max = Math.max(1, ...(trades ?? []).map((t) => t.sol));

  return (
    <div className="card p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg tracking-[0.2em] text-green glow-green">🖨️ MONEY PRINTER</span>
        <span className="text-[10px] text-muted tracking-widest">BIGGEST BUYS</span>
      </div>
      {!trades ? (
        <RowSkeleton rows={limit} />
      ) : trades.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
          <div className="text-3xl">🫧</div>
          <div className="font-display font-bold text-xl tracking-wide">NOTHING PRINTED YET</div>
          <p className="text-xs text-muted max-w-[220px]">The biggest buys of the last 24h show up here as they happen.</p>
        </div>
      ) : (
        <ul className="space-y-1.5 flex-1">
          {trades.map((t) => (
            <li key={t.id} className="animate-slide-in">
              <Link href={`/coin/${t.mint}`} className="relative flex items-center gap-2 h-10 px-2 rounded-md hover:bg-white/5 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 bg-green/10" style={{ width: `${(t.sol / max) * 100}%` }} />
                <span className="relative text-base w-6 text-center">{emoji[t.mint] ?? "💸"}</span>
                <span className="relative font-display text-lg tracking-wide w-20 truncate">${t.ticker}</span>
                <span className="relative text-[11px] text-muted hidden sm:inline">{shortAddr(t.wallet, 3)}</span>
                <span className="relative flex-1" />
                <span className="relative font-display text-xl text-green tabular">{fmtSol(t.sol, 2)} SOL</span>
                <span className="relative text-[10px] text-muted w-14 text-right">{timeAgo(t.ts)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
