import { gradeColor } from "@/lib/tiers";
import type { RugGrade } from "@/types";

export function RugBadge({ grade, score, size = "sm" }: { grade: RugGrade; score?: number; size?: "sm" | "lg" }) {
  const color = gradeColor(grade);
  const dims = size === "lg" ? "w-16 h-16 text-4xl" : "w-7 h-7 text-sm";
  return (
    <div className="inline-flex items-center gap-2" title={`Rug Check score ${score ?? ""}`}>
      <span
        className={`${dims} rounded-md font-display flex items-center justify-center border`}
        style={{ color, borderColor: color + "66", background: color + "14", boxShadow: `0 0 14px ${color}33` }}
      >
        {grade}
      </span>
      {size === "lg" && score !== undefined && (
        <div>
          <div className="stat-label">Rug Check</div>
          <div className="font-display text-2xl" style={{ color }}>
            {score}/100
          </div>
        </div>
      )}
    </div>
  );
}
