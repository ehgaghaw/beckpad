"use client";
import Link from "next/link";
import { TierBadge } from "@/components/ui/TierBadge";
import { RowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { compact, fmtSol, shortAddr } from "@/lib/format";
import type { Caller, Range } from "@/types";

export function LeaderboardTable({ callers, range, loading, highlight }: { callers: Caller[] | null; range: Range; loading: boolean; highlight?: string | null }) {
  if (loading) return <RowSkeleton rows={10} />;
  if (!callers || callers.length === 0)
    return (
      <EmptyState
        icon="📣"
        title="NO CALLERS YET"
        body="Generate a referral link on your profile, share it, and every buy through it ranks you here."
        action={{ href: "/", label: "FIND A COIN TO CALL" }}
      />
    );
  const max = Math.max(1, ...callers.map((c) => c.volumeSol[range]));
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left stat-label bg-black/40">
              <th className="px-3 py-2.5 font-semibold w-12">#</th>
              <th className="px-3 py-2.5 font-semibold">Caller</th>
              <th className="px-3 py-2.5 font-semibold">Tier</th>
              <th className="px-3 py-2.5 font-semibold text-right">Tracked volume</th>
              <th className="px-3 py-2.5 font-semibold text-right">Buyers</th>
              <th className="px-3 py-2.5 font-semibold text-right">Coins</th>
              <th className="px-3 py-2.5 font-semibold text-right">Win rate</th>
              <th className="px-3 py-2.5 font-semibold">Best call</th>
            </tr>
          </thead>
          <tbody>
            {callers.map((c, i) => {
              const hl = highlight && c.handle.toLowerCase() === highlight.toLowerCase();
              return (
                <tr key={c.id} id={`caller-${c.handle}`} className={`border-t border-line/60 relative ${hl ? "bg-gold/10" : "hover:bg-white/[0.03]"}`}>
                  <td className="px-3 py-3">
                    <span className={`font-display text-2xl ${i === 0 ? "text-gold glow-gold" : i === 1 ? "text-[#C0C0C0]" : i === 2 ? "text-[#CD7F32]" : "text-muted"}`}>{i + 1}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-display text-lg text-black shrink-0"
                        style={{ background: `linear-gradient(135deg, hsl(${c.hue} 80% 60%), hsl(${(c.hue + 60) % 360} 80% 40%))` }}
                      >
                        {c.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate">{c.name}</div>
                        <Link href={`/profile/${c.handle}`} className="text-xs text-muted hover:text-white font-mono">
                          {shortAddr(c.handle, 4)}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <TierBadge tier={c.tier} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="font-display text-2xl text-green tabular leading-none">
                      <AnimatedNumber value={c.volumeSol[range]} format={(n) => fmtSol(n, 1)} /> <span className="text-xs font-sans text-muted">SOL</span>
                    </div>
                    <div className="h-1 mt-1 rounded bg-black/60 overflow-hidden ml-auto w-32">
                      <div className="h-full bg-green/70" style={{ width: `${(c.volumeSol[range] / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular">{compact(c.buyers[range], 0)}</td>
                  <td className="px-3 py-3 text-right tabular">{c.coinsCalled}</td>
                  <td className={`px-3 py-3 text-right tabular font-bold ${c.winRate >= 0.5 ? "text-green" : "text-red"}`}>{(c.winRate * 100).toFixed(0)}%</td>
                  <td className="px-3 py-3">
                    {c.bestCall ? (
                      <Link href={`/coin/${c.bestCall.mint}`} className="text-xs font-bold hover:text-gold">
                        ${c.bestCall.ticker} <span className="text-green">{c.bestCall.multiple.toFixed(1)}x</span>
                      </Link>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
