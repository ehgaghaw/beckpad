"use client";
import { use } from "react";
import { api } from "@/lib/api";
import { useAsync, useWorldEvents } from "@/lib/hooks";
import { useIdentity } from "@/lib/wallet";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ReferralLinks } from "@/components/profile/ReferralLinks";
import { CreatorFees } from "@/components/profile/CreatorFees";
import { CoinCard } from "@/components/coin/CoinCard";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProfilePage(props: PageProps<"/profile/[wallet]">) {
  const { wallet } = use(props.params);
  const id = useIdentity();
  const isSelf = id.address === wallet;
  const { data, loading, setData, reload } = useAsync(() => api.getProfile(wallet), [wallet]);

  useWorldEvents((e) => {
    if (e.type === "coin" && data?.launches.some((c) => c.mint === e.coin.mint)) {
      setData((p) => (p ? { ...p, launches: p.launches.map((c) => (c.mint === e.coin.mint ? e.coin : c)) } : p));
    }
    if (e.type === "trade" && e.trade.source?.kind === "referral" && data?.referralLinks.some((l) => `ref:${l.code}` === e.trade.source?.id)) {
      reload();
    }
  });

  if (loading || !data) {
    return (
      <div className="pt-6 space-y-4">
        <Skeleton className="h-56" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-5">
      <ProfileHeader profile={data} isSelf={isSelf} />

      {isSelf && <CreatorFees wallet={wallet} launches={data.launches.length} />}

      <ReferralLinks
        wallet={wallet}
        links={data.referralLinks}
        isSelf={isSelf}
        onCreated={(l) => setData((p) => (p ? { ...p, referralLinks: [l, ...p.referralLinks] } : p))}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg tracking-[0.2em]">🚀 LAUNCHES</span>
          <span className="text-xs text-muted">{data.launches.length}</span>
        </div>
        {data.launches.length === 0 ? (
          <EmptyState
            icon="🧪"
            title="NO LAUNCHES YET"
            body={isSelf ? "Your coins will show up here with their curve progress and Rug Check." : "This wallet hasn't launched anything on AlexPad."}
            action={isSelf ? { href: "/launch", label: "LAUNCH A COIN" } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.launches.map((c) => (
              <CoinCard key={c.mint} coin={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
