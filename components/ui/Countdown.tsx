"use client";
import { useNow } from "@/lib/hooks";
import { fmtDuration, pad2 } from "@/lib/format";

/** Big HH:MM:SS countdown to a target timestamp. */
export function Countdown({ target, label = "to graduation" }: { target: number; label?: string }) {
  const now = useNow(1000);
  const d = fmtDuration(target - now);
  const soon = target - now < 10 * 60_000;
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={`font-display text-4xl sm:text-5xl tabular leading-none ${soon ? "text-green glow-green" : "text-gold glow-gold"}`}>
        {pad2(d.h)}
        <span className="opacity-50">:</span>
        {pad2(d.m)}
        <span className="opacity-50">:</span>
        {pad2(d.s)}
      </div>
    </div>
  );
}
