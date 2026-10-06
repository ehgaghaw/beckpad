import { RugBadge } from "@/components/ui/RugBadge";
import type { RugCheck } from "@/types";

function Check({ label, value, ok, warn }: { label: string; value: string; ok: boolean; warn?: boolean }) {
  const color = ok ? "text-green" : warn ? "text-gold" : "text-red";
  return (
    <div className="flex items-center justify-between py-2 border-b border-line/60 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-bold tabular flex items-center gap-1.5 ${color}`}>
        <span className="text-xs">{ok ? "✔" : warn ? "⚠" : "✖"}</span>
        {value}
      </span>
    </div>
  );
}

export function RugCheckPanel({ rug }: { rug: RugCheck }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg tracking-[0.2em] text-white">🧯 RUG CHECK</span>
        <RugBadge grade={rug.grade} score={rug.score} size="lg" />
      </div>
      <Check label="Dev wallet holds" value={`${rug.devWalletPct.toFixed(1)}%`} ok={rug.devWalletPct <= 8} warn={rug.devWalletPct <= 15} />
      <Check label="Top 10 holders" value={`${rug.top10Pct.toFixed(1)}%`} ok={rug.top10Pct <= 30} warn={rug.top10Pct <= 50} />
      <Check label="Bundled buys (first block)" value={rug.bundledBuys === 0 ? "none" : `${rug.bundledBuys} wallets`} ok={!rug.bundledDetected} warn={rug.bundledBuys > 0} />
      <Check label="Dev sold" value={rug.devSold ? "YES" : "no"} ok={!rug.devSold} />
      <Check label="Dev lock" value={rug.devLocked ? "LOCKED 🔒" : "not locked"} ok={rug.devLocked} warn={!rug.devLocked} />
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {rug.notes.map((n) => (
          <li key={n} className="text-[11px] px-2 py-0.5 rounded border border-line text-muted">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
