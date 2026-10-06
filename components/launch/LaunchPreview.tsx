"use client";
import { CoinCard } from "@/components/coin/CoinCard";
import { curveState } from "@/lib/curve";
import { SOL_USD } from "@/lib/format";
import type { Coin, LaunchInput } from "@/types";

/** Builds a throwaway Coin from the form so the real CoinCard can render it. */
export function previewCoin(input: LaunchInput): Coin {
  const net = input.devBuySol * 0.99;
  const s = curveState(net);
  const devPct = (s.tokensSold / 1_000_000_000) * 100;
  const score = input.devLock ? 92 : 78;
  return {
    mint: "preview",
    name: input.name || "Your coin",
    ticker: (input.ticker || "TICKER").toUpperCase(),
    description: input.description,
    emoji: input.emoji || "🪙",
    hue: 45,
    imageUrl: input.imageUrl,
    creator: input.creator || "you",
    createdAt: 0,
    realSol: net,
    priceSol: s.priceSol,
    marketCapSol: s.marketCapSol,
    marketCapUsd: s.marketCapSol * SOL_USD,
    curvePct: s.pct,
    holders: input.devBuySol > 0 ? 1 : 0,
    volume24hSol: input.devBuySol,
    change24h: 0,
    replies: 0,
    graduated: false,
    devLock: input.devLock,
    devBuySol: input.devBuySol,
    socials: input.socials,
    rug: {
      devWalletPct: +devPct.toFixed(1),
      top10Pct: +devPct.toFixed(1),
      bundledBuys: 0,
      bundledDetected: false,
      devSold: false,
      devLocked: input.devLock,
      score,
      grade: input.devLock ? "A" : "B",
      notes: [],
    },
    attribution: [],
    topSource: null,
  };
}

export function LaunchPreview({ input }: { input: LaunchInput }) {
  const coin = previewCoin(input);
  return (
    <div className="space-y-3">
      <div className="stat-label">Preview card</div>
      <div className="pointer-events-none">
        <CoinCard coin={coin} />
      </div>
      <div className="card p-3 text-xs text-muted space-y-1">
        <div className="flex justify-between">
          <span>Starting market cap</span>
          <span className="text-white tabular">${(curveState(0).marketCapSol * SOL_USD).toFixed(0)}</span>
        </div>
        <div className="flex justify-between">
          <span>Dev buy</span>
          <span className="text-white tabular">{input.devBuySol} SOL → {coin.rug.devWalletPct}% of supply</span>
        </div>
        <div className="flex justify-between">
          <span>Graduation</span>
          <span className="text-white tabular">85 SOL on curve</span>
        </div>
        <div className="flex justify-between">
          <span>Dev lock</span>
          <span className={input.devLock ? "text-green" : "text-gold"}>{input.devLock ? "90 days, badge shown" : "off"}</span>
        </div>
      </div>
    </div>
  );
}
