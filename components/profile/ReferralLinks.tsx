"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { absoluteRefUrl } from "@/lib/referral";
import { fmtSol, timeAgo } from "@/lib/format";
import type { ReferralLink } from "@/types";

export function ReferralLinks({ wallet, links, isSelf, onCreated }: { wallet: string; links: ReferralLink[]; isSelf: boolean; onCreated: (l: ReferralLink) => void }) {
  const [label, setLabel] = useState("");
  const [mint, setMint] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: coins } = useAsync(() => api.listCoins("trending", 100), []);

  const create = async () => {
    setBusy(true);
    try {
      const l = await api.createReferralLink(wallet, label, mint || undefined);
      onCreated(l);
      setLabel("");
      const url = absoluteRefUrl(l.url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link created & copied", { description: url });
      } catch {
        toast.success("Link created", { description: url });
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = async (l: ReferralLink) => {
    const url = absoluteRefUrl(l.url);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied", { description: url });
    } catch {
      toast(url);
    }
  };

  const total = links.reduce((a, b) => a + b.volumeSol, 0);

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg tracking-[0.2em] text-green glow-green">🔗 REFERRAL LINKS</span>
        <span className="text-xs text-muted tabular">
          {links.length} links · <span className="text-green font-bold">{fmtSol(total, 1)} SOL</span> tracked
        </span>
      </div>

      {isSelf && (
        <div className="rounded-lg border border-line bg-black/40 p-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. X thread, TG group)" className="h-10 px-3 rounded-lg bg-black/60 border border-line text-sm focus:outline-none focus:border-gold" />
          <select value={mint} onChange={(e) => setMint(e.target.value)} className="h-10 px-3 rounded-lg bg-black/60 border border-line text-sm focus:outline-none focus:border-gold">
            <option value="">Whole site (/?ref=…)</option>
            {(coins ?? []).map((c) => (
              <option key={c.mint} value={c.mint}>
                ${c.ticker} — {c.name}
              </option>
            ))}
          </select>
          <button onClick={create} disabled={busy} className="h-10 px-4 rounded-lg bg-green text-black font-display text-lg tracking-wider disabled:opacity-50">
            + GENERATE
          </button>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">No referral links yet{isSelf ? ". Generate one and share it — every buy through it is attributed to you." : "."}</p>
      ) : (
        <div className="overflow-x-auto scrollbar-thin -mx-1">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="text-left stat-label">
                <th className="px-2 py-1.5 font-semibold">Link</th>
                <th className="px-2 py-1.5 font-semibold">Coin</th>
                <th className="px-2 py-1.5 font-semibold text-right">Clicks</th>
                <th className="px-2 py-1.5 font-semibold text-right">Buys</th>
                <th className="px-2 py-1.5 font-semibold text-right">Buyers</th>
                <th className="px-2 py-1.5 font-semibold text-right">Volume</th>
                <th className="px-2 py-1.5 font-semibold text-right">Conv.</th>
                <th className="px-2 py-1.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.code} className="border-t border-line/60 hover:bg-white/[0.03]">
                  <td className="px-2 py-2">
                    <div className="font-bold">{l.label}</div>
                    <div className="font-mono text-green">{l.code}</div>
                    <div className="text-[10px] text-muted">{timeAgo(l.createdAt)}</div>
                  </td>
                  <td className="px-2 py-2">
                    {l.mint ? (
                      <Link href={`/coin/${l.mint}`} className="font-bold hover:text-gold">
                        ${l.ticker}
                      </Link>
                    ) : (
                      <span className="text-muted">site</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular">{l.clicks}</td>
                  <td className="px-2 py-2 text-right tabular">{l.buys}</td>
                  <td className="px-2 py-2 text-right tabular">{l.uniqueBuyers}</td>
                  <td className="px-2 py-2 text-right tabular font-bold text-green">{fmtSol(l.volumeSol, 2)} SOL</td>
                  <td className="px-2 py-2 text-right tabular">{l.clicks ? ((l.buys / l.clicks) * 100).toFixed(1) : "0.0"}%</td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => copy(l)} className="h-7 px-2 rounded border border-line text-muted hover:text-white">
                      copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
