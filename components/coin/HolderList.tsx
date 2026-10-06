"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { RowSkeleton } from "@/components/ui/Skeleton";
import { fmtTokens, shortAddr } from "@/lib/format";

export function HolderList({ mint }: { mint: string }) {
  const { data, loading } = useAsync(() => api.getHolders(mint), [mint]);
  const max = Math.max(1, ...(data ?? []).map((h) => h.pct));
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg tracking-[0.2em]">👥 HOLDERS</span>
        <span className="text-[10px] text-muted tracking-widest">TOP {data?.length ?? 0}</span>
      </div>
      {loading ? (
        <RowSkeleton rows={8} />
      ) : (
        <ol className="space-y-1">
          {(data ?? []).map((h, i) => (
            <li key={h.wallet} className="relative flex items-center gap-2 h-8 px-2 rounded-md overflow-hidden text-xs">
              <div className="absolute left-0 top-0 bottom-0 bg-gold/10" style={{ width: `${(h.pct / max) * 100}%` }} />
              <span className="relative w-5 text-muted tabular">{i + 1}.</span>
              {h.isCurve ? (
                <span className="relative font-semibold text-ice">bonding curve</span>
              ) : (
                <Link href={`/profile/${h.wallet}`} className="relative font-mono hover:text-gold">
                  {shortAddr(h.wallet, 4)}
                </Link>
              )}
              {h.isDev && <span className="relative text-[10px] px-1.5 rounded bg-red/15 text-red border border-red/40 font-bold">DEV</span>}
              <span className="relative flex-1" />
              <span className="relative text-muted hidden sm:inline">{fmtTokens(h.tokens)}</span>
              <span className="relative font-bold tabular w-14 text-right">{h.pct.toFixed(2)}%</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
