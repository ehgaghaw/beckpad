"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync, useTick, useWorldEvents } from "@/lib/hooks";
import { RowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SourceChip } from "@/components/ui/SourceChip";
import { fmtSol, fmtTokens, shortAddr, timeAgo } from "@/lib/format";

export function TradeHistory({ mint }: { mint: string }) {
  const { data, loading, setData } = useAsync(() => api.getTrades(mint, 40), [mint]);
  useTick(5000);
  useWorldEvents((e) => {
    if (e.type === "trade" && e.trade.mint === mint) setData((prev) => [e.trade, ...(prev ?? [])].slice(0, 40));
  });
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg tracking-[0.2em]">📜 TRADES</span>
        <span className="text-[10px] text-muted tracking-widest flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" /> LIVE
        </span>
      </div>
      {loading ? (
        <RowSkeleton rows={8} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="🫧" title="NO TRADES YET" body="Be the first buy on the curve." />
      ) : (
        <div className="overflow-x-auto scrollbar-thin -mx-1 max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left stat-label">
                <th className="px-2 py-1.5 font-semibold">Side</th>
                <th className="px-2 py-1.5 font-semibold">Wallet</th>
                <th className="px-2 py-1.5 font-semibold text-right">SOL</th>
                <th className="px-2 py-1.5 font-semibold text-right">Tokens</th>
                <th className="px-2 py-1.5 font-semibold">Source</th>
                <th className="px-2 py-1.5 font-semibold text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-t border-line/60 animate-slide-in">
                  <td className={`px-2 py-2 font-display text-base tracking-wider ${t.side === "buy" ? "text-green" : "text-red"}`}>{t.side.toUpperCase()}</td>
                  <td className="px-2 py-2 font-mono">
                    <Link href={`/profile/${t.wallet}`} className="hover:text-gold">
                      {shortAddr(t.wallet, 4)}
                    </Link>
                  </td>
                  <td className={`px-2 py-2 text-right tabular font-bold ${t.side === "buy" ? "text-green" : "text-red"}`}>{fmtSol(t.sol, 3)}</td>
                  <td className="px-2 py-2 text-right tabular text-muted">{fmtTokens(t.tokens)}</td>
                  <td className="px-2 py-2">{t.side === "buy" ? <SourceChip source={t.source} /> : <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-2 text-right text-muted whitespace-nowrap">{timeAgo(t.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
