"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync, useWorldEvents } from "@/lib/hooks";
import { Tabs } from "@/components/ui/Tabs";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CoinCard } from "./CoinCard";
import type { Coin, CoinTab } from "@/types";

const TABS: { value: CoinTab; label: string }[] = [
  { value: "trending", label: "TRENDING" },
  { value: "new", label: "NEW" },
  { value: "graduating", label: "ABOUT TO GRADUATE" },
  { value: "graduated", label: "GRADUATED" },
];

export function CoinGrid() {
  const [tab, setTab] = useState<CoinTab>("trending");
  const [query, setQuery] = useState("");
  const { data, loading, setData } = useAsync(() => api.listCoins(tab), [tab]);

  // Patch live updates into whatever list we are showing
  useWorldEvents((e) => {
    if (e.type !== "coin") return;
    setData((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((c) => c.mint === e.coin.mint);
      if (idx === -1) {
        if (tab === "new" && !e.coin.graduated) return [e.coin, ...prev];
        return prev;
      }
      const next = prev.slice();
      next[idx] = e.coin;
      return next;
    });
  });

  const q = query.trim().toLowerCase();
  const list: Coin[] = (data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q));

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={tab} onChange={setTab} options={TABS} />
        <div className="flex-1" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or ticker"
          className="h-9 px-3 rounded-lg bg-black/60 border border-line text-sm w-full sm:w-64 focus:outline-none focus:border-gold"
        />
      </div>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="🧻"
          title={q ? "NOTHING MATCHES" : "NOTHING HERE YET"}
          body={q ? "Try a different ticker." : "Be the first to launch in this lane."}
          action={{ href: "/launch", label: "LAUNCH A COIN" }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <CoinCard key={c.mint} coin={c} />
          ))}
        </div>
      )}
    </section>
  );
}
