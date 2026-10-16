"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync, useTick, useWorldEvents } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegBar } from "@/components/ui/CurveBar";
import { compact, fmtPct, fmtUsd, timeAgo } from "@/lib/format";
import type { Coin, CoinTab } from "@/types";

const TABS: { value: CoinTab; label: string }[] = [
  { value: "trending", label: "all" },
  { value: "new", label: "new" },
  { value: "graduating", label: "graduating" },
  { value: "graduated", label: "graduated" },
];

/** Every coin on the curve, as numbered rows in an archive. */
export function Ledger() {
  const [tab, setTab] = useState<CoinTab>("trending");
  const [query, setQuery] = useState("");
  const { data, loading, setData } = useAsync(() => api.listCoins(tab), [tab]);
  useTick(15_000);
  useWorldEvents((e) => {
    if (e.type !== "coin") return;
    setData((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((c) => c.mint === e.coin.mint);
      if (idx === -1) return tab === "new" && !e.coin.graduated ? [e.coin, ...prev] : prev;
      const next = prev.slice();
      next[idx] = e.coin;
      return next;
    });
  });
  const q = query.trim().toLowerCase();
  const list: Coin[] = (data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q));

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">{"// archive"}</div>
          <h2 className="font-display text-4xl sm:text-5xl leading-none mt-1">Every coin on the curve</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center font-mono text-[11px] uppercase tracking-[0.18em]">
            {TABS.map((t, i) => (
              <span key={t.value} className="flex items-center">
                {i > 0 && <span className="text-line px-2">/</span>}
                <button onClick={() => setTab(t.value)} className={`py-1 transition ${tab === t.value ? "text-gold" : "text-muted hover:text-white"}`}>
                  {tab === t.value ? `[${t.label}]` : t.label}
                </button>
              </span>
            ))}
          </div>
          <label className="flex items-center gap-2 font-mono text-xs border-b border-line focus-within:border-gold transition">
            <span className="text-gold">&gt;</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search_" className="h-8 w-36 sm:w-48 bg-transparent focus:outline-none placeholder:text-muted" />
          </label>
        </div>
      </div>

      <div className="hidden md:grid grid-cols-[48px_1fr_110px_90px_110px_160px] gap-4 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.24em] text-muted border-b border-line">
        <span>no.</span>
        <span>subject</span>
        <span className="text-right">mkt cap</span>
        <span className="text-right">holders</span>
        <span className="text-right">vol 24h</span>
        <span>curve</span>
      </div>

      {loading ? (
        <div className="divide-y divide-line">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 my-1" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center">
          <div className="font-display text-3xl">{q ? "No match" : "Nothing filed here"}</div>
          <p className="font-mono text-xs text-muted mt-2">{q ? "Try another ticker." : "Be the first to launch in this lane."}</p>
          <Link href="/launch" className="inline-flex mt-5 h-10 px-5 bg-gold text-black font-mono text-[11px] font-bold uppercase tracking-[0.18em] items-center hover:bg-white transition">
            + Launch a coin
          </Link>
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {list.map((c, i) => (
            <li key={c.mint} className="animate-slide-in" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <Link href={`/coin/${c.mint}`} className="ledger-row grid grid-cols-[48px_1fr] md:grid-cols-[48px_1fr_110px_90px_110px_160px] gap-x-4 gap-y-2 items-center px-3 py-3">
                <span className="font-mono text-[11px] text-muted tabular">{String(i + 1).padStart(3, "0")}</span>
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 shrink-0 bg-black border border-line overflow-hidden flex items-center justify-center text-xl">
                    {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover pixelated" /> : <span className="font-display text-white/20">?</span>}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2 min-w-0">
                      <span className="font-display text-xl sm:text-2xl leading-none truncate">{c.name}</span>
                      <span className="font-mono text-[11px] text-gold tracking-[0.14em] shrink-0">${c.ticker}</span>
                    </span>
                    <span className="flex items-center gap-3 font-mono text-[10px] text-muted mt-1">
                      <span>{c.createdAt ? timeAgo(c.createdAt) : "just now"}</span>
                      <span className={c.change24h >= 0 ? "text-green" : "text-red"}>{fmtPct(c.change24h, 0)}</span>
                      <span className="text-muted/70">rug {c.rug.grade}</span>
                      {c.graduated && <span className="text-ice">graduated</span>}
                    </span>
                  </span>
                </span>
                <span className="md:text-right font-mono text-sm tabular col-start-2 md:col-start-auto">
                  <span className="md:hidden text-[9px] uppercase tracking-[0.2em] text-muted mr-2">mcap</span>
                  <span className="text-gold">{fmtUsd(c.marketCapUsd)}</span>
                  <span className="md:hidden text-[9px] uppercase tracking-[0.2em] text-muted mx-2">· holders</span>
                  <span className="md:hidden">{compact(c.holders, 0)}</span>
                  <span className="md:hidden text-[9px] uppercase tracking-[0.2em] text-muted mx-2">· vol</span>
                  <span className="md:hidden">{compact(c.volume24hSol, 1)} SOL</span>
                </span>
                <span className="hidden md:block text-right font-mono text-sm tabular">{compact(c.holders, 0)}</span>
                <span className="hidden md:block text-right font-mono text-sm tabular">
                  {compact(c.volume24hSol, 1)} <span className="text-muted text-[10px]">SOL</span>
                </span>
                <span className="col-start-2 md:col-start-auto">
                  <SegBar pct={c.curvePct} graduated={c.graduated} blocks={16} compact />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
