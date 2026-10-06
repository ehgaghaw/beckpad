"use client";
import Link from "next/link";
import { useLiveFeed, useMounted } from "@/lib/hooks";
import { fmtSol, shortAddr } from "@/lib/format";
import type { LiveEvent } from "@/types";

function Item({ e }: { e: LiveEvent }) {
  const color = e.kind === "buy" ? "text-green" : e.kind === "sell" ? "text-red" : e.kind === "launch" ? "text-gold" : "text-ice";
  const verb = e.kind === "buy" ? "bought" : e.kind === "sell" ? "sold" : e.kind === "launch" ? "LAUNCHED" : "GRADUATED 🎓";
  return (
    <Link href={`/coin/${e.mint}`} className="inline-flex items-center gap-1.5 px-4 text-xs whitespace-nowrap hover:bg-white/5">
      <span>{e.emoji}</span>
      {e.kind === "buy" || e.kind === "sell" ? (
        <>
          <span className="text-muted">{shortAddr(e.wallet ?? "", 3)}</span>
          <span className={color}>{verb}</span>
          <span className={`${color} font-bold tabular`}>{fmtSol(e.sol ?? 0, 2)} SOL</span>
          <span className="text-white font-semibold">${e.ticker}</span>
        </>
      ) : (
        <>
          <span className="text-white font-semibold">${e.ticker}</span>
          <span className={`${color} font-bold`}>{verb}</span>
        </>
      )}
    </Link>
  );
}

export function LiveTicker() {
  const events = useLiveFeed(24);
  const mounted = useMounted();
  const list = events.slice(0, 24);
  return (
    <div className="h-7 border-b border-line bg-black/60 overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-black text-[10px] font-bold tracking-[0.2em] text-green border-r border-line">
        <span className="w-1.5 h-1.5 rounded-full bg-green mr-2 animate-pulse" />
        LIVE
      </div>
      {mounted && list.length > 0 ? (
        <div className="flex h-full items-center animate-ticker w-max pl-16" style={{ animationDuration: `${Math.max(30, list.length * 3)}s` }}>
          {[...list, ...list].map((e, i) => (
            <Item key={e.id + i} e={e} />
          ))}
        </div>
      ) : (
        <div className="h-full flex items-center pl-20 text-[11px] text-muted">
          {mounted ? "quiet on the curve — launches and buys stream here live" : "connecting…"}
        </div>
      )}
    </div>
  );
}
