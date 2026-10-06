"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { usePumpTx, EXPLORER } from "@/lib/solana";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { fmtSol } from "@/lib/format";

/** Creator-fee vault for the connected wallet: shows claimable SOL and claims it in one transaction. */
export function CreatorFees({ wallet, launches }: { wallet: string; launches: number }) {
  const sendTx = usePumpTx();
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useAsync(() => api.getCreatorFees(wallet), [wallet]);
  const claimable = data?.claimableSol ?? 0;

  const claim = async () => {
    setBusy(true);
    const t = toast.loading("Claiming creator fees…", { description: "Building transaction…" });
    try {
      const signature = await sendTx({ action: "collectCreatorFee" }, [], (s) => toast.loading("Claiming creator fees…", { id: t, description: s }));
      toast.success(`Claimed ${fmtSol(claimable, 4)} SOL`, {
        id: t,
        description: "Creator fees sent to your wallet.",
        action: { label: "Solscan", onClick: () => window.open(EXPLORER(signature), "_blank") },
        duration: 8000,
      });
      setTimeout(reload, 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Claim failed";
      toast.error(/user rejected|rejected the request/i.test(msg) ? "Cancelled in wallet" : msg, { id: t, duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 sm:p-5 box-glow-gold flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <div className="font-display font-bold text-lg tracking-[0.2em] text-gold glow-gold">💰 CREATOR FEES</div>
        <p className="text-xs text-muted mt-1 max-w-lg">
          pump.fun pays you a cut of every trade on your coins (0.30% while on the curve, 0.95% after graduation). It collects in your creator vault
          until you claim it. {launches === 0 && "Launch a coin to start earning."}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="stat-label">Claimable</div>
          <div className="font-display font-bold text-3xl text-green glow-green leading-none tabular">
            {loading ? "…" : <AnimatedNumber value={claimable} format={(n) => fmtSol(n, 4)} />} <span className="text-sm font-sans text-muted">SOL</span>
          </div>
        </div>
        <button
          onClick={claim}
          disabled={busy || loading || claimable <= 0}
          className="h-12 px-5 rounded-lg bg-gold text-black font-display font-bold text-xl tracking-widest box-glow-gold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition"
          title={claimable <= 0 ? "Nothing to claim yet" : "Claim all creator fees"}
        >
          {busy ? "CLAIMING…" : "CLAIM"}
        </button>
      </div>
    </div>
  );
}
