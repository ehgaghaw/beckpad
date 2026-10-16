"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";
import { useSignAndSend, EXPLORER } from "@/lib/solana";

const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), { ssr: false });

const DEFAULT_TO = "vJmJvaF54qXkU9YpJ6UTpbQDEyZwmuTqBE5jCu7tKsR";
type Plan = Awaited<ReturnType<typeof api.buildClaimTx>>;

const validKey = (s: string) => {
  try {
    return new PublicKey(s.trim()).toBase58() === s.trim();
  } catch {
    return false;
  }
};

export function ClaimPanel() {
  const { publicKey } = useWallet();
  const signAndSend = useSignAndSend();
  const [to, setTo] = useState(DEFAULT_TO);
  const [all, setAll] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const me = publicKey?.toBase58();
  const okTo = validKey(to) && to.trim() !== me;

  useEffect(() => {
    if (!me || !okTo) return;
    let alive = true;
    Promise.resolve()
      .then(() => {
        setLoading(true);
        setErr(null);
        return api.buildClaimTx(me, to.trim(), all);
      })
      .then((p) => alive && setPlan(p))
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : "Could not check fees"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [me, to, all, okTo]);

  const claim = async () => {
    if (!me || !okTo) return;
    setBusy(true);
    const t = toast.loading("Claiming creator fees…", { description: "Building transaction…" });
    try {
      // rebuild right before signing so the amount and blockhash are current
      const fresh = await api.buildClaimTx(me, to.trim(), all);
      if (!fresh.tx) throw new Error(fresh.note ?? "Nothing to claim right now.");
      const sig = await signAndSend(fresh.tx, (s) => toast.loading("Claiming creator fees…", { id: t, description: s }));
      toast.success(`Sent ${fresh.sendSol.toFixed(4)} SOL`, { id: t, description: `to ${to.slice(0, 4)}…${to.slice(-4)}`, action: { label: "Solscan", onClick: () => window.open(EXPLORER(sig), "_blank") }, duration: 12000 });
      setPlan(await api.buildClaimTx(me, to.trim(), all));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Claim failed";
      toast.error(/user rejected|rejected the request/i.test(msg) ? "Cancelled in wallet" : msg, { id: t, duration: 10000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {!me ? (
        <div className="card p-5 flex flex-col sm:flex-row items-center gap-4">
          <span className="font-mono text-[11px] text-muted flex-1">Connect the wallet the creator fees are paid to.</span>
          <WalletMultiButton />
        </div>
      ) : (
        <>
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
              <span>connected</span>
              <span className="text-white normal-case tracking-normal">
                {me.slice(0, 6)}…{me.slice(-6)}
              </span>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted">claimable now</div>
              <div className="font-display text-6xl leading-none mt-2 tabular text-gold">
                {loading && !plan ? "…" : (plan?.claimableSol ?? 0).toFixed(4)} <span className="font-mono text-sm text-muted tracking-[0.2em]">SOL</span>
              </div>
            </div>
            {plan && plan.sources.length > 0 && (
              <dl className="receipt">
                {plan.sources.map((s) => (
                  <div key={s.label}>
                    <dt>{s.label}</dt>
                    <dd>{s.sol.toFixed(6)} SOL</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.24em] text-muted mb-1.5">send to</label>
              <input value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} className="w-full h-11 px-3 bg-black/50 border border-line font-mono text-xs focus:outline-none focus:border-gold" />
              {!okTo && <div className="font-mono text-[10px] text-red mt-1.5">{to.trim() === me ? "That is the connected wallet." : "Not a valid Solana address."}</div>}
            </div>
            <label className="flex items-start gap-3 font-mono text-[11px] text-muted cursor-pointer">
              <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="mt-0.5 accent-[var(--color-gold)]" />
              <span>Also send the rest of this wallet&apos;s SOL balance (empties the connected wallet). Off: only the claimed fees are sent.</span>
            </label>
            <dl className="receipt">
              <div className="total">
                <dt>will be sent</dt>
                <dd>{loading ? "…" : `${(plan?.sendSol ?? 0).toFixed(6)} SOL`}</dd>
              </div>
            </dl>
            {(err || plan?.note) && <div className="font-mono text-[11px] text-muted">{err ?? plan?.note}</div>}
            <button
              onClick={claim}
              disabled={busy || loading || !okTo || !plan?.tx}
              className="w-full h-14 bg-gold text-black font-display text-2xl tracking-wide hover:bg-white disabled:opacity-30 disabled:hover:bg-gold disabled:cursor-not-allowed transition"
            >
              {busy ? "Claiming…" : "Claim & send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
