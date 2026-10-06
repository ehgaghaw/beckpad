import { tierMeta } from "@/lib/tiers";
import type { Tier } from "@/types";

const ICON: Record<Tier, string> = {
  Bronze: "🥉",
  Silver: "🥈",
  Gold: "🥇",
  Diamond: "💎",
  "Whale Tier": "🐋",
};

export function TierBadge({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "lg" }) {
  const m = tierMeta(tier);
  const dims = size === "lg" ? "h-10 px-4 text-xl" : "h-6 px-2 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-display tracking-widest ${dims}`}
      style={{ color: m.color, borderColor: m.color + "66", background: m.color + "14", boxShadow: `0 0 14px ${m.glow}` }}
    >
      <span className={size === "lg" ? "text-lg" : "text-xs"}>{ICON[tier]}</span>
      {m.label}
    </span>
  );
}
