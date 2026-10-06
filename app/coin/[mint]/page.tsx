"use client";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAsync, useGraduationTarget, useLiveCoin, useTick } from "@/lib/hooks";
import { CoinAvatar } from "@/components/ui/CoinAvatar";
import { CurveBar } from "@/components/ui/CurveBar";
import { StatBox } from "@/components/ui/StatBox";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SourceChip } from "@/components/ui/SourceChip";
import { Countdown } from "@/components/ui/Countdown";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriceChart } from "@/components/coin/PriceChart";
import { TradePanel } from "@/components/coin/TradePanel";
import { RugCheckPanel } from "@/components/coin/RugCheckPanel";
import { AttributionPanel } from "@/components/coin/AttributionPanel";
import { HolderList } from "@/components/coin/HolderList";
import { TradeHistory } from "@/components/coin/TradeHistory";
import { Comments } from "@/components/coin/Comments";
import { compact, fmtPct, fmtPrice, fmtUsd, shortAddr, timeAgo } from "@/lib/format";

export default function CoinPage(props: PageProps<"/coin/[mint]">) {
  const { mint } = use(props.params);
  const { data, loading } = useAsync(() => api.getCoin(mint), [mint]);
  const coin = useLiveCoin(data);
  useTick(15_000);
  const target = useGraduationTarget(coin);

  if (loading) {
    return (
      <div className="pt-6 space-y-4">
        <div className="flex gap-4 items-center">
          <Skeleton className="w-16 h-16 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (!coin) {
    return (
      <div className="pt-10">
        <EmptyState icon="🕳️" title="COIN NOT FOUND" body="This mint is not on BeckPad (or the session was reset)." action={{ href: "/", label: "BACK TO COINS" }} />
      </div>
    );
  }

  const share = async () => {
    const url = `${window.location.origin}/coin/${coin.mint}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast(url);
    }
  };

  return (
    <div className="pt-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <CoinAvatar emoji={coin.emoji} hue={coin.hue} imageUrl={coin.imageUrl} size={72} className="rounded-2xl" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-5xl tracking-wide leading-none flex items-center gap-3 flex-wrap">
              {coin.name} <span className="text-muted text-2xl sm:text-3xl">${coin.ticker}</span>
              {coin.graduated && <span className="text-xs font-sans font-bold tracking-widest text-ice border border-ice/40 bg-ice/10 px-2 py-1 rounded">GRADUATED</span>}
              {coin.devLock && <span className="text-xs font-sans font-bold tracking-widest text-green border border-green/40 bg-green/10 px-2 py-1 rounded">🔒 DEV LOCKED</span>}
            </h1>
            <div className="text-xs text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                by{" "}
                <Link href={`/profile/${coin.creator}`} className="font-mono text-gold hover:underline">
                  {shortAddr(coin.creator)}
                </Link>
              </span>
              <span>{timeAgo(coin.createdAt)}</span>
              <span className="font-mono hidden sm:inline">{shortAddr(coin.mint, 6)}</span>
              {coin.socials.twitter && (
                <a href={coin.socials.twitter} target="_blank" rel="noreferrer" className="hover:text-white">
                  𝕏
                </a>
              )}
              {coin.socials.telegram && (
                <a href={coin.socials.telegram} target="_blank" rel="noreferrer" className="hover:text-white">
                  telegram
                </a>
              )}
              {coin.socials.website && (
                <a href={coin.socials.website} target="_blank" rel="noreferrer" className="hover:text-white">
                  website
                </a>
              )}
              <button onClick={share} className="hover:text-white">
                share ↗
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <SourceChip source={coin.topSource} prefix="top source" />
        </div>
      </div>
      <p className="text-sm text-muted max-w-3xl">{coin.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
        <StatBox label="Market cap" tone="gold">
          <AnimatedNumber value={coin.marketCapUsd} format={fmtUsd} />
        </StatBox>
        <StatBox label="Price" sub={`${compact(coin.marketCapSol, 1)} SOL mcap`}>
          <span className="text-lg sm:text-xl">
            <AnimatedNumber value={coin.priceSol} format={fmtPrice} flash />
          </span>
        </StatBox>
        <StatBox label="24h" tone={coin.change24h >= 0 ? "green" : "red"}>
          {fmtPct(coin.change24h, 1)}
        </StatBox>
        <StatBox label="Holders">
          <AnimatedNumber value={coin.holders} format={(n) => compact(n, 0)} />
        </StatBox>
        <StatBox label="Vol 24h" sub="SOL">
          <AnimatedNumber value={coin.volume24hSol} format={(n) => compact(n, 1)} />
        </StatBox>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <PriceChart mint={coin.mint} />
          <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <CurveBar pct={coin.curvePct} graduated={coin.graduated} size="lg" />
              <p className="text-[11px] text-muted mt-2">
                {coin.graduated
                  ? "Curve complete — liquidity migrated to the DEX pool."
                  : `${(85 * (1 - coin.curvePct / 100)).toFixed(1)} SOL left on the curve. At 85 SOL the pool graduates and LP is burned.`}
              </p>
            </div>
            {!coin.graduated && <Countdown target={target} label="est. graduation" />}
          </div>
          <AttributionPanel coin={coin} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <HolderList mint={coin.mint} />
            <TradeHistory mint={coin.mint} />
          </div>
          <Comments mint={coin.mint} />
        </div>
        <div className="space-y-4 lg:sticky lg:top-28 self-start">
          <TradePanel coin={coin} />
          <RugCheckPanel rug={coin.rug} />
        </div>
      </div>
    </div>
  );
}
