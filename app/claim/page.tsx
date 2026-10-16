import type { Metadata } from "next";
import { ClaimPanel } from "@/components/claim/ClaimPanel";

export const metadata: Metadata = { title: "Claim", robots: { index: false, follow: false } };

export default function ClaimPage() {
  return (
    <div className="pt-10 sm:pt-14 space-y-8 max-w-2xl">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
          <span className="inline-block w-1.5 h-1.5 bg-gold mr-2 align-middle animate-pulse" />
          creator fees
        </div>
        <h1 className="font-display leading-[0.85] text-[clamp(56px,9vw,120px)] mt-3">CLAIM</h1>
        <p className="mt-4 font-mono text-xs text-muted leading-relaxed max-w-lg">
          Connect the wallet that receives the creator fees. One approval collects everything claimable from pump.fun and forwards it to the address below.
        </p>
      </header>
      <ClaimPanel />
    </div>
  );
}
