"use client";
/* eslint-disable @next/next/no-img-element */
import { initialSnapshot, marketCapOf, priceOf, progressOf, quoteBuy } from "@/lib/curve";
import { SOL_USD } from "@/lib/format";
import type { Coin, LaunchInput } from "@/types";

/** Builds a throwaway Coin from the form so the preview and the confirm step can show real numbers. */
export function previewCoin(input: LaunchInput): Coin {
  const start = initialSnapshot();
  const q = input.devBuySol > 0 ? quoteBuy(start, input.devBuySol) : null;
  const s = q ? q.next : start;
  const devPct = q ? (q.tokensOut / s.totalSupply) * 100 : 0;
  return {
    mint: "preview",
    name: input.name || "Untitled",
    ticker: (input.ticker || "TICKER").toUpperCase(),
    description: input.description,
    emoji: input.emoji || "🪙",
    hue: 280,
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

/** The coin as it will appear in the archive: a file card with the image, the name, and the numbers at launch. */
export function LaunchPreview({ input, compact = false }: { input: LaunchInput; compact?: boolean }) {
  const coin = previewCoin(input);
  const startMcap = marketCapOf(initialSnapshot()) * SOL_USD;
  const lines: Array<[string, string]> = [
    ["opening mcap", `$${startMcap.toFixed(0)}`],
    ["after dev buy", `$${coin.marketCapUsd.toFixed(0)}`],
    ["dev holds", `${coin.rug.devWalletPct}% of supply`],
    ["rug check", `grade ${coin.rug.grade} · ${coin.rug.score}/100`],
    ["graduation", "~85 SOL on curve"],
  ];
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.24em] text-muted">
        <span>{"// file preview"}</span>
        <span className="text-gold">unfiled</span>
      </div>
      <div className="relative aspect-square bg-black border-b border-line flex items-center justify-center overflow-hidden">
        {coin.imageUrl ? <img src={coin.imageUrl} alt="" className="w-full h-full object-cover pixelated" /> : <span className="font-display text-6xl text-white/10">?</span>}
        <span className="scanline" aria-hidden />
        {!coin.imageUrl && <span className="absolute bottom-3 font-mono text-[9px] uppercase tracking-[0.24em] text-muted">awaiting image</span>}
      </div>
      <div className="p-4">
        <div className="font-display text-3xl leading-none truncate">{coin.name}</div>
        <div className="font-mono text-[11px] text-gold tracking-[0.18em] mt-1">${coin.ticker}</div>
        {!compact && <p className="font-mono text-[11px] text-muted mt-2 line-clamp-3 min-h-[3em]">{coin.description || "No description yet."}</p>}
        <dl className="mt-4 border-t border-line font-mono text-[11px]">
          {lines.map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-line/60 last:border-0">
              <dt className="text-muted uppercase tracking-[0.14em] text-[9px] self-center">{k}</dt>
              <dd className="text-white tabular">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
