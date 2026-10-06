"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync, useGraduationTarget, useLiveCoin } from "@/lib/hooks";
import { CoinAvatar } from "@/components/ui/CoinAvatar";
import { CurveBar } from "@/components/ui/CurveBar";
import { Countdown } from "@/components/ui/Countdown";
import { RugBadge } from "@/components/ui/RugBadge";
import { SourceChip } from "@/components/ui/SourceChip";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useWorldEvents } from "@/lib/hooks";
import { compact, fmtUsd } from "@/lib/format";

export function CoinOfTheHour() {
  const { data, loading, reload } = useAsync(() => api.getCoinOfTheHour(), []);
  const coin = useLiveCoin(data);
  // Projected graduation: remaining curve at the current buy pace. Fixed once per coin so it ticks down smoothly.
  const target = useGraduationTarget(coin);
  // A launch may change which coin is featured
  useWorldEvents((e) => {
    if (e.type === "live" && (e.event.kind === "launch" || e.event.kind === "graduate")) reload();
  });

  if (!loading && !coin) {
    return (
      <EmptyState
        icon="🖨️"
        title="NO COINS YET"
        body="The curve is empty. Launch the first coin and it becomes Coin of the Hour by default."
        action={{ href: "/launch", label: "LAUNCH THE FIRST COIN" }}
      />
    );
  }

  if (loading || !coin) {
    return (
      <div className="card p-5 sm:p-6 space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-4">
          <Skeleton className="w-24 h-24 rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6 relative overflow-hidden box-glow-gold">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
      <div className="flex items-center justify-between mb-4">
        <span className="font-display text-lg tracking-[0.2em] text-gold glow-gold">⚡ COIN OF THE HOUR</span>
        <RugBadge grade={coin.rug.grade} score={coin.rug.score} />
      </div>
      <div className="flex gap-4 sm:gap-5">
        <Link href={`/coin/${coin.mint}`}>
          <CoinAvatar emoji={coin.emoji} hue={coin.hue} imageUrl={coin.imageUrl} size={96} className="rounded-2xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/coin/${coin.mint}`} className="font-display text-3xl sm:text-4xl tracking-wide leading-none hover:text-gold transition">
            {coin.name} <span className="text-muted text-2xl">${coin.ticker}</span>
          </Link>
          <p className="text-sm text-muted mt-1 line-clamp-2">{coin.description}</p>
          <div className="mt-2">
            <SourceChip source={coin.topSource} prefix="driven by" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-5">
        <div>
          <div className="stat-label">Market cap</div>
          <div className="font-display text-3xl sm:text-4xl text-gold glow-gold leading-none">
            <AnimatedNumber value={coin.marketCapUsd} format={fmtUsd} />
          </div>
        </div>
        <div>
          <div className="stat-label">Holders</div>
          <div className="font-display text-3xl sm:text-4xl leading-none">
            <AnimatedNumber value={coin.holders} format={(n) => compact(n, 0)} />
          </div>
        </div>
        <div>
          <div className="stat-label">Vol 24h</div>
          <div className="font-display text-3xl sm:text-4xl leading-none">
            <AnimatedNumber value={coin.volume24hSol} format={(n) => compact(n, 1)} />
            <span className="text-sm text-muted font-sans"> SOL</span>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <CurveBar pct={coin.curvePct} graduated={coin.graduated} size="lg" />
      </div>
      <div className="mt-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <Countdown target={target} />
        <Link
          href={`/coin/${coin.mint}`}
          className="h-12 px-6 rounded-lg bg-green text-black font-display text-xl tracking-wider flex items-center justify-center box-glow-green hover:brightness-110 active:scale-95 transition"
        >
          APE IN →
        </Link>
      </div>
    </div>
  );
}
