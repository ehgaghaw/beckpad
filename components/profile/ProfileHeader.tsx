"use client";
import { toast } from "sonner";
import { TierBadge } from "@/components/ui/TierBadge";
import { StatBox } from "@/components/ui/StatBox";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { nextTier, tierMeta } from "@/lib/tiers";
import { fmtSol, shortAddr, timeAgo } from "@/lib/format";
import type { Profile } from "@/types";

export function ProfileHeader({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const meta = tierMeta(profile.tier);
  const next = nextTier(profile.tier);
  const progress = next ? Math.min(100, ((profile.trackedVolumeSol - meta.min) / (next.min - meta.min)) * 100) : 100;
  const hue = parseInt(profile.wallet.slice(-2), 36) * 11;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.wallet);
      toast.success("Address copied");
    } catch {
      toast(profile.wallet);
    }
  };

  return (
    <div className="card p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: meta.glow }} />
      <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center font-display text-4xl text-black shrink-0"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 60%), hsl(${(hue + 60) % 360} 80% 40%))`, boxShadow: `0 0 24px ${meta.glow}` }}
        >
          {profile.wallet.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={copy} className="font-display text-3xl sm:text-4xl tracking-wide hover:text-gold" title={profile.wallet}>
              {shortAddr(profile.wallet, 5)}
            </button>
            <TierBadge tier={profile.tier} size="lg" />
            {isSelf && <span className="text-[10px] font-bold tracking-widest text-muted border border-line px-2 py-1 rounded">YOU</span>}
          </div>
          <div className="text-xs text-muted mt-1">joined {timeAgo(profile.joinedAt)} · {profile.tradesCount} trades</div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="stat-label">{next ? `Progress to ${next.label}` : "Max tier reached"}</span>
              <span className="text-muted tabular">
                {fmtSol(profile.trackedVolumeSol, 0)} / {next ? `${next.min}` : "∞"} SOL
              </span>
            </div>
            <div className="h-2 rounded-full bg-black/60 border border-line overflow-hidden">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress}%`, background: next ? next.color : meta.color }} />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-5">
        <StatBox label="Degen score" tone="gold">
          <AnimatedNumber value={profile.degenScore} format={(n) => n.toFixed(0)} />
        </StatBox>
        <StatBox label="Tracked volume" tone="green" sub="SOL via your links & launches">
          <AnimatedNumber value={profile.trackedVolumeSol} format={(n) => fmtSol(n, 1)} />
        </StatBox>
        <StatBox label="Launches">{profile.launches.length}</StatBox>
        <StatBox label="PnL" tone={profile.pnlSol >= 0 ? "green" : "red"} sub="SOL, simulated">
          {profile.pnlSol >= 0 ? "+" : ""}
          {fmtSol(profile.pnlSol, 1)}
        </StatBox>
      </div>
    </div>
  );
}
