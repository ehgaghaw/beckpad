import type { RugGrade, Tier } from "@/types";

export const TIERS: { tier: Tier; min: number; color: string; glow: string; label: string }[] = [
  { tier: "Bronze", min: 0, color: "#CD7F32", glow: "rgba(205,127,50,0.45)", label: "BRONZE" },
  { tier: "Silver", min: 50, color: "#C0C0C0", glow: "rgba(192,192,192,0.45)", label: "SILVER" },
  { tier: "Gold", min: 250, color: "#F5C542", glow: "rgba(245,197,66,0.5)", label: "GOLD" },
  { tier: "Diamond", min: 1000, color: "#7DF9FF", glow: "rgba(125,249,255,0.5)", label: "DIAMOND" },
  { tier: "Whale Tier", min: 5000, color: "#22FF88", glow: "rgba(34,255,136,0.55)", label: "WHALE TIER" },
];

export function tierForVolume(volumeSol: number): Tier {
  let t: Tier = "Bronze";
  for (const row of TIERS) if (volumeSol >= row.min) t = row.tier;
  return t;
}

export function tierMeta(tier: Tier) {
  return TIERS.find((t) => t.tier === tier) ?? TIERS[0];
}

export function nextTier(tier: Tier) {
  const i = TIERS.findIndex((t) => t.tier === tier);
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null;
}

export function gradeColor(grade: RugGrade) {
  switch (grade) {
    case "A":
      return "#22FF88";
    case "B":
      return "#A3FF5C";
    case "C":
      return "#F5C542";
    case "D":
      return "#FF8A3B";
    default:
      return "#FF3B5C";
  }
}

export function scoreToGrade(score: number): RugGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}
