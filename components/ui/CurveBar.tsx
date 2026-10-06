"use client";
import { clamp } from "@/lib/format";

export function CurveBar({
  pct,
  graduated = false,
  size = "md",
  showLabel = true,
}: {
  pct: number;
  graduated?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const p = graduated ? 100 : clamp(pct, 0, 100);
  const h = size === "sm" ? "h-1.5" : size === "lg" ? "h-4" : "h-2.5";
  const hot = p >= 85;
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="stat-label">Bonding curve</span>
          <span className={`text-xs font-bold tabular ${graduated ? "text-ice" : hot ? "text-green glow-green" : "text-gold"}`}>
            {graduated ? "GRADUATED" : `${p.toFixed(1)}%`}
          </span>
        </div>
      )}
      <div className={`${h} w-full rounded-full bg-black/60 border border-line overflow-hidden relative`}>
        <div
          className={`${h} rounded-full transition-[width] duration-700 ease-out ${
            graduated
              ? "bg-ice"
              : hot
                ? "bg-gradient-to-r from-gold via-green to-green animate-pulse-glow"
                : "bg-gradient-to-r from-gold/70 to-gold"
          }`}
          style={{ width: `${p}%` }}
        />
        {!graduated && size === "lg" && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-widest text-black mix-blend-screen">
            {p.toFixed(1)}% TO GRADUATION
          </div>
        )}
      </div>
    </div>
  );
}
