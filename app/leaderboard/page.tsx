"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { TIERS } from "@/lib/tiers";
import { Tabs } from "@/components/ui/Tabs";
import { TierBadge } from "@/components/ui/TierBadge";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import type { Range } from "@/types";

function LeaderboardInner() {
  const params = useSearchParams();
  const highlight = params.get("caller");
  const [range, setRange] = useState<Range>("7d");
  const { data, loading } = useAsync(() => api.getLeaderboard(range), [range]);

  useEffect(() => {
    if (!highlight || loading) return;
    document.getElementById(`caller-${highlight}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight, loading]);

  return (
    <div className="pt-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <h1 className="font-display text-4xl sm:text-6xl tracking-wide leading-none text-gold glow-gold">CALLER LEADERBOARD</h1>
          <p className="text-sm text-muted mt-2 max-w-2xl">
            Ranked by SOL volume actually attributed to their links and posts. Follower counts don&apos;t count. Rank up through the tiers by bringing real buyers.
          </p>
        </div>
        <div className="flex-1" />
        <Tabs
          value={range}
          onChange={setRange}
          options={[
            { value: "24h", label: "24H" },
            { value: "7d", label: "7D" },
            { value: "all", label: "ALL TIME" },
          ]}
        />
      </div>

      <div className="card p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="stat-label mr-1">Tiers</span>
        {TIERS.map((t, i) => (
          <div key={t.tier} className="flex items-center gap-2">
            <TierBadge tier={t.tier} />
            <span className="text-[11px] text-muted tabular">{t.min > 0 ? `${t.min}+ SOL` : "start"}</span>
            {i < TIERS.length - 1 && <span className="text-muted/50">→</span>}
          </div>
        ))}
      </div>

      <LeaderboardTable callers={data} range={range} loading={loading} highlight={highlight} />
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <LeaderboardInner />
    </Suspense>
  );
}
