"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync, useGraduationTarget, useLiveCoin, useNow, useWorldEvents } from "@/lib/hooks";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SegBar } from "@/components/ui/CurveBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { compact, fmtDuration, fmtPct, fmtUsd, pad2 } from "@/lib/format";

/** The strongest signal on the curve right now, laid out like a case file. */
export function Dossier() {
  const { data, loading, reload } = useAsync(() => api.getCoinOfTheHour(), []);
  const coin = useLiveCoin(data);
  const target = useGraduationTarget(coin);
  const now = useNow(1000);
  useWorldEvents((e) => {
    if (e.type === "live" && (e.event.kind === "launch" || e.event.kind === "graduate")) reload();
  });

  if (!loading && !coin) {
    return (
      <div className="card p-8 sm:p-12 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">{"// file 01 · empty"}</div>
        <div className="font-display text-4xl sm:text-6xl mt-3">No signal yet</div>
        <p className="font-mono text-xs text-muted mt-3 max-w-md mx-auto">The curve is silent. The first coin launched here takes this slot by default.</p>
        <Link href="/launch" className="inline-flex mt-6 h-11 px-6 bg-gold text-black font-mono text-xs font-bold uppercase tracking-[0.18em] items-center hover:bg-white transition">
          + Initiate the first launch
        </Link>
      </div>
    );
  }
  if (loading || !coin) {
    return (
      <div className="card p-6 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  const d = fmtDuration(target - now);
  const soon = target - now < 10 * 60_000;
  const rows: Array<[string, React.ReactNode]> = [
    ["market cap", <AnimatedNumber key="m" value={coin.marketCapUsd} format={fmtUsd} />],
    ["holders", <AnimatedNumber key="h" value={coin.holders} format={(n) => compact(n, 0)} />],
    ["vol 24h", <><AnimatedNumber key="v" value={coin.volume24hSol} format={(n) => compact(n, 1)} /> <span className="text-muted text-xs">SOL</span></>],
    ["24h", <span key="c" className={coin.change24h >= 0 ? "text-green" : "text-red"}>{fmtPct(coin.change24h, 0)}</span>],
  ];

  return (
    <article className="card overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr]">
      <Link href={`/coin/${coin.mint}`} className="relative aspect-square md:aspect-auto md:min-h-[360px] bg-black border-b md:border-b-0 md:border-r border-line group overflow-hidden">
        {coin.imageUrl ? (
          <img src={coin.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pixelated opacity-90 group-hover:opacity-100 group-hover:scale-[1.03] transition duration-700" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[120px]">{coin.emoji}</div>
        )}
        <div className="scanline" aria-hidden />
        <span className="absolute left-3 top-3 font-mono text-[9px] uppercase tracking-[0.24em] bg-black/70 px-2 py-1">file 01 · strongest signal</span>
        <span className="absolute right-3 bottom-3 font-mono text-[9px] uppercase tracking-[0.24em] bg-gold text-black px-2 py-1">rug check {coin.rug.grade}</span>
      </Link>
      <div className="p-5 sm:p-7 flex flex-col gap-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-gold animate-pulse" /> live on the curve
          </div>
          <Link href={`/coin/${coin.mint}`} className="block mt-2 font-display text-[clamp(40px,6vw,84px)] leading-[0.9] hover:text-gold transition">
            {coin.name}
          </Link>
          <div className="mt-2 font-mono text-sm text-gold tracking-[0.18em]">${coin.ticker}</div>
          <p className="mt-3 font-mono text-xs text-muted leading-relaxed line-clamp-2 max-w-xl">{coin.description}</p>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-line">
          {rows.map(([k, v]) => (
            <div key={k} className="py-3 pr-3 border-b border-line sm:border-b-0 sm:border-r last:border-r-0 sm:pl-3 first:pl-0">
              <dt className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted">{k}</dt>
              <dd className="font-display text-2xl sm:text-3xl mt-1 tabular">{v}</dd>
            </div>
          ))}
        </dl>
        <SegBar pct={coin.curvePct} graduated={coin.graduated} />
        <div className="flex flex-wrap items-end justify-between gap-4 mt-auto">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted">t-minus graduation</div>
            <div className={`font-mono text-3xl sm:text-4xl tabular mt-1 ${soon ? "text-green" : "text-white"}`}>
              {pad2(d.h)}<span className="text-muted">:</span>{pad2(d.m)}<span className="text-muted">:</span>{pad2(d.s)}
            </div>
          </div>
          <Link href={`/coin/${coin.mint}`} className="h-11 px-6 bg-gold text-black font-mono text-xs font-bold uppercase tracking-[0.18em] flex items-center hover:bg-white hover:shadow-[0_0_30px_rgba(183,95,224,0.6)] transition">
            Open file →
          </Link>
        </div>
      </div>
    </article>
  );
}
