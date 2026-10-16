"use client";
import { clamp } from "@/lib/format";

/** Bonding-curve progress as a row of blocks, like a loading bar on an old terminal. */
export function SegBar({ pct, graduated = false, blocks = 24, compact = false }: { pct: number; graduated?: boolean; blocks?: number; compact?: boolean }) {
  const p = graduated ? 100 : clamp(pct, 0, 100);
  const lit = Math.round((p / 100) * blocks);
  const hot = p >= 85;
  const color = graduated ? "bg-ice" : hot ? "bg-green" : "bg-gold";
  return (
    <div className="w-full">
      {!compact && (
        <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.24em] mb-1.5">
          <span className="text-muted">bonding curve</span>
          <span className={graduated ? "text-ice" : hot ? "text-green" : "text-gold"}>{graduated ? "graduated" : `${p.toFixed(1)}%`}</span>
        </div>
      )}
      <div className="flex gap-[2px]" title={`${p.toFixed(1)}%`}>
        {Array.from({ length: blocks }).map((_, i) => (
          <span key={i} className={`flex-1 ${compact ? "h-2" : "h-3"} ${i < lit ? color : "bg-white/10"} ${i === lit - 1 && !graduated ? "animate-pulse" : ""}`} />
        ))}
      </div>
      {compact && <div className={`font-mono text-[9px] mt-1 ${graduated ? "text-ice" : "text-muted"}`}>{graduated ? "graduated" : `${p.toFixed(1)}%`}</div>}
    </div>
  );
}

/** Kept for older pages that still import it. */
export function CurveBar({ pct, graduated = false, size = "md", showLabel = true }: { pct: number; graduated?: boolean; size?: "sm" | "md" | "lg"; showLabel?: boolean }) {
  return <SegBar pct={pct} graduated={graduated} blocks={size === "lg" ? 32 : size === "sm" ? 16 : 24} compact={!showLabel} />;
}
