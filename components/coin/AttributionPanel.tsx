"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useIdentity } from "@/lib/wallet";
import { absoluteRefUrl } from "@/lib/referral";
import { SourceChip } from "@/components/ui/SourceChip";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { fmtSol } from "@/lib/format";
import type { Attribution, Coin, SourceKind } from "@/types";

const COLOR: Record<SourceKind, string> = { caller: "#F5C542", x_post: "#FFFFFF", referral: "#22FF88", direct: "#555555" };

export function AttributionPanel({ coin }: { coin: Coin }) {
  const id = useIdentity();
  const [busy, setBusy] = useState(false);
  const rows: Attribution[] = coin.attribution;
  const totalVol = rows.reduce((a, b) => a + b.volumeSol, 0);
  const totalBuys = rows.reduce((a, b) => a + b.buys, 0);
  const tracked = rows.filter((r) => r.source.kind !== "direct").reduce((a, b) => a + b.volumeSol, 0);
  const max = Math.max(1e-9, ...rows.map((r) => r.volumeSol));

  const makeLink = async () => {
    if (!id.address) return toast.error("Connect or enable a demo wallet first");
    setBusy(true);
    try {
      const link = await api.createReferralLink(id.address, `${coin.ticker} link`, coin.mint);
      const url = absoluteRefUrl(link.url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Referral link copied", { description: url });
      } catch {
        toast.success("Referral link created", { description: url });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 sm:p-5 box-glow-gold">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <span className="font-display text-lg tracking-[0.2em] text-gold glow-gold">🎯 ATTRIBUTION</span>
        <button
          onClick={makeLink}
          disabled={busy}
          className="h-8 px-3 rounded-md border border-green/50 text-green text-xs font-bold hover:bg-green/10 disabled:opacity-50"
        >
          + MY REF LINK
        </button>
      </div>
      <p className="text-xs text-muted mb-4">Every buy is traced to the link, post or caller that drove it. Volume talks, follower counts don&apos;t.</p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-black/40 border border-line p-2.5">
          <div className="stat-label">Tracked volume</div>
          <div className="font-display text-2xl text-green leading-none">
            <AnimatedNumber value={tracked} format={(n) => fmtSol(n, 1)} /> <span className="text-xs font-sans text-muted">SOL</span>
          </div>
        </div>
        <div className="rounded-lg bg-black/40 border border-line p-2.5">
          <div className="stat-label">Tracked share</div>
          <div className="font-display text-2xl text-gold leading-none">
            <AnimatedNumber value={totalVol ? (tracked / totalVol) * 100 : 0} format={(n) => n.toFixed(0) + "%"} />
          </div>
        </div>
        <div className="rounded-lg bg-black/40 border border-line p-2.5">
          <div className="stat-label">Buys</div>
          <div className="font-display text-2xl leading-none">
            <AnimatedNumber value={totalBuys} format={(n) => n.toFixed(0)} />
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="space-y-2 mb-4">
        {rows.map((r) => (
          <div key={r.source.id} className="flex items-center gap-2">
            <div className="w-36 sm:w-48 shrink-0 min-w-0">
              <SourceChip source={r.source} className="max-w-full" />
            </div>
            <div className="flex-1 h-5 rounded bg-black/50 border border-line overflow-hidden">
              <div
                className="h-full rounded-r transition-[width] duration-700"
                style={{ width: `${(r.volumeSol / max) * 100}%`, background: COLOR[r.source.kind], opacity: r.source.kind === "direct" ? 0.6 : 0.85, boxShadow: `0 0 12px ${COLOR[r.source.kind]}55` }}
              />
            </div>
            <span className="w-12 text-right text-xs font-bold tabular">{(r.share * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin -mx-1">
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="text-left stat-label">
              <th className="px-2 py-1.5 font-semibold">Source</th>
              <th className="px-2 py-1.5 font-semibold">Type</th>
              <th className="px-2 py-1.5 font-semibold text-right">Buys</th>
              <th className="px-2 py-1.5 font-semibold text-right">Buyers</th>
              <th className="px-2 py-1.5 font-semibold text-right">Volume</th>
              <th className="px-2 py-1.5 font-semibold text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source.id} className="border-t border-line/60 hover:bg-white/[0.03]">
                <td className="px-2 py-2 font-semibold max-w-[220px] truncate">
                  {r.source.url ? (
                    <a href={r.source.url} target="_blank" rel="noreferrer" className="hover:text-gold">
                      {r.source.label}
                    </a>
                  ) : (
                    r.source.label
                  )}
                </td>
                <td className="px-2 py-2 text-muted capitalize">{r.source.kind.replace("_", " ")}</td>
                <td className="px-2 py-2 text-right tabular">{r.buys}</td>
                <td className="px-2 py-2 text-right tabular">{r.uniqueBuyers}</td>
                <td className="px-2 py-2 text-right tabular font-bold text-green">{fmtSol(r.volumeSol, 2)} SOL</td>
                <td className="px-2 py-2 text-right tabular">{(r.share * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
