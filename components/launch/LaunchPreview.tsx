"use client";
import { CoinCard } from "@/components/coin/CoinCard";
import { initialSnapshot, marketCapOf, priceOf, progressOf, quoteBuy } from "@/lib/curve";
import { SOL_USD } from "@/lib/format";
import type { Coin, LaunchInput } from "@/types";

/** Builds a throwaway Coin from the form so the real CoinCard can render it. */
export function previewCoin(input: LaunchInput): Coin {
  const start = initialSnapshot();
  const q = input.devBuySol > 0 ? quoteBuy(start, input.devBuySol) : null;
  const s = q ? q.next : start;
  const devPct = q ? (q.tokensOut / s.totalSupply) * 100 : 0;
  return {
    mint: "preview",
    name: input.name || "Your coin",
    ticker: (input.ticker || "TICKER").toUpperCase(),
    description: input.description,
    emoji: input.emoji || "🪙",
    hue: 45,
    imageUrl: input.imageUrl,
    metadataUri: "",
    signature: "",
    creator: input.creator || "you",
    createdAt: 0,
    curve: s,
    realSol: s.realSol,
    priceSol: priceOf(s),
    marketCapSol: marketCapOf(s),
    marketCapUsd: marketCapOf(s) * SOL_USD,
    curvePct: progressOf(s),
    holders: input.devBuySol > 0 ? 1 : 0,
    volume24hSol: input.devBuySol,
    change24h: 0,
    replies: 0,
    graduated: false,
    devLock: false,
    devBuySol: input.devBuySol,
    socials: input.socials,
    rug: {
      devWalletPct: +devPct.toFixed(1),
      top10Pct: +devPct.toFixed(1),
      bundledBuys: 0,
      bundledDetected: false,
      devSold: false,
      devLocked: false,
      score: Math.round(Math.max(0, 100 - devPct * 1.6)),
      grade: devPct <= 9 ? "A" : devPct <= 18 ? "B" : "C",
      notes: [],
    },
    attribution: [],
    topSource: null,
  };
}

export function LaunchPreview({ input }: { input: LaunchInput }) {
  const coin = previewCoin(input);
  const startMcap = marketCapOf(initialSnapshot()) * SOL_USD;
  return (
    <div className="space-y-3">
      <div className="stat-label">Preview card</div>
      <div className="pointer-events-none">
        <CoinCard coin={coin} />
      </div>
      <div className="card p-3 text-xs text-muted space-y-1">
        <div className="flex justify-between">
          <span>Starting market cap</span>
          <span className="text-white tabular">${startMcap.toFixed(0)}</span>
        </div>
        <div className="flex justify-between">
          <span>Dev buy</span>
          <span className="text-white tabular">
            {input.devBuySol.toFixed(2)} SOL → {coin.rug.devWalletPct}% of supply
          </span>
        </div>
        <div className="flex justify-between">
          <span>Graduation</span>
          <span className="text-white tabular">~85 SOL on curve</span>
        </div>
        <div className="flex justify-between">
          <span>Network + creation cost</span>
          <span className="text-white tabular">~0.02 SOL</span>
        </div>
      </div>
    </div>
  );
}
