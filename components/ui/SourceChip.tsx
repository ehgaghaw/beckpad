import Link from "next/link";
import type { Source } from "@/types";

const ICON: Record<Source["kind"], string> = { caller: "📣", x_post: "𝕏", referral: "🔗", direct: "🌐" };
const CLS: Record<Source["kind"], string> = {
  caller: "border-gold/50 text-gold bg-gold/10",
  x_post: "border-white/30 text-white bg-white/5",
  referral: "border-green/50 text-green bg-green/10",
  direct: "border-line text-muted bg-white/5",
};

export function SourceChip({
  source,
  prefix,
  className = "",
  link = true,
}: {
  source: Source | null;
  prefix?: string;
  className?: string;
  /** Set false when the chip is rendered inside another <a> (e.g. CoinCard). */
  link?: boolean;
}) {
  if (!source) {
    return <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-md border border-line text-[11px] text-muted ${className}`}>no tracked source</span>;
  }
  const body = (
    <span className={`inline-flex items-center gap-1.5 px-2 h-6 rounded-md border text-[11px] font-semibold max-w-full ${CLS[source.kind]} ${className}`}>
      {prefix && <span className="text-[10px] font-normal opacity-70 whitespace-nowrap">{prefix}</span>}
      <span className="text-xs leading-none">{ICON[source.kind]}</span>
      <span className="truncate">{source.label}</span>
    </span>
  );
  if (link && source.kind === "caller") return <Link href={`/leaderboard?caller=${source.handle}`}>{body}</Link>;
  return body;
}
