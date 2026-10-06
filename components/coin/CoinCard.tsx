"use client";
import Link from "next/link";
import { CoinAvatar } from "@/components/ui/CoinAvatar";
import { CurveBar } from "@/components/ui/CurveBar";
import { RugBadge } from "@/components/ui/RugBadge";
import { SourceChip } from "@/components/ui/SourceChip";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { compact, fmtPct, fmtUsd, timeAgo } from "@/lib/format";
import { useTick } from "@/lib/hooks";
import type { Coin } from "@/types";

export function CoinCard({ coin }: { coin: Coin }) {
  useTick(15_000);
  return (
    <Link
      href={`/coin/${coin.mint}`}
      className="card p-4 flex flex-col gap-3 hover:border-gold/50 hover:-translate-y-0.5 transition group relative overflow-hidden"
    >
      {coin.graduated && (
        <span className="absolute top-3 right-3 text-[10px] font-bold tracking-widest text-ice border border-ice/40 bg-ice/10 px-1.5 py-0.5 rounded">
          GRADUATED
        </span>
      )}
      <div className="flex items-start gap-3">
        <CoinAvatar emoji={coin.emoji} hue={coin.hue} imageUrl={coin.imageUrl} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-xl tracking-wide truncate">{coin.name}</span>
            <span className="text-xs text-muted font-semibold">${coin.ticker}</span>
          </div>
          <div className="text-[11px] text-muted flex items-center gap-2">
            <span>{timeAgo(coin.createdAt)}</span>
            {coin.devLock && <span className="text-green">🔒 dev locked</span>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <RugBadge grade={coin.rug.grade} score={coin.rug.score} />
            <span className={`text-xs font-bold tabular ${coin.change24h >= 0 ? "text-green" : "text-red"}`}>{fmtPct(coin.change24h, 0)}</span>
          </div>
        </div>
      </div>

      <CurveBar pct={coin.curvePct} graduated={coin.graduated} size="sm" />

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="stat-label">Mkt cap</div>
          <div className="font-display text-xl text-gold leading-none">
            <AnimatedNumber value={coin.marketCapUsd} format={fmtUsd} />
          </div>
        </div>
        <div>
          <div className="stat-label">Holders</div>
          <div className="font-display text-xl leading-none">
            <AnimatedNumber value={coin.holders} format={(n) => compact(n, 0)} />
          </div>
        </div>
        <div>
          <div className="stat-label">Vol 24h</div>
          <div className="font-display text-xl leading-none">
            <AnimatedNumber value={coin.volume24hSol} format={(n) => compact(n, 1)} /> <span className="text-xs text-muted font-sans">SOL</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/70">
        <SourceChip source={coin.topSource} prefix="top source" className="min-w-0" link={false} />
        <span className="text-[11px] text-muted shrink-0">💬 {coin.replies}</span>
      </div>
    </Link>
  );
}
