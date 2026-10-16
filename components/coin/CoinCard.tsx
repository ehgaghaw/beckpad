"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { SegBar } from "@/components/ui/CurveBar";
import { compact, fmtPct, fmtUsd, timeAgo } from "@/lib/format";
import { useTick } from "@/lib/hooks";
import type { Coin } from "@/types";

/** A coin as a file strip: square image, condensed name, one mono line of numbers, the curve. Used on profiles and the launch preview. */
export function CoinCard({ coin }: { coin: Coin }) {
  useTick(15_000);
  const body = (
    <>
      <span className="w-16 h-16 shrink-0 bg-black border border-line overflow-hidden flex items-center justify-center text-3xl relative">
        {coin.imageUrl ? <img src={coin.imageUrl} alt="" className="w-full h-full object-cover pixelated" /> : coin.emoji}
        <span className="scanline" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 grid gap-1.5">
        <span className="flex items-baseline gap-2 min-w-0">
          <span className="font-display text-2xl leading-none truncate">{coin.name}</span>
          <span className="font-mono text-[11px] text-gold tracking-[0.14em] shrink-0">${coin.ticker}</span>
          {coin.graduated && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ice shrink-0">graduated</span>}
        </span>
        <span className="font-mono text-[11px] text-muted flex flex-wrap gap-x-3">
          <span className="text-white">{fmtUsd(coin.marketCapUsd)}</span>
          <span>{compact(coin.holders, 0)} holders</span>
          <span>{compact(coin.volume24hSol, 1)} SOL vol</span>
          <span className={coin.change24h >= 0 ? "text-green" : "text-red"}>{fmtPct(coin.change24h, 0)}</span>
          <span>{coin.createdAt ? timeAgo(coin.createdAt) : "just now"}</span>
        </span>
        <SegBar pct={coin.curvePct} graduated={coin.graduated} blocks={20} compact />
      </span>
    </>
  );
  const cls = "card ledger-row flex items-center gap-4 p-3";
  return coin.mint === "preview" ? <div className={cls}>{body}</div> : <Link href={`/coin/${coin.mint}`} className={cls}>{body}</Link>;
}
