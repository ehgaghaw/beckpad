"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useIdentity } from "@/lib/wallet";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false, loading: () => <div className="h-10 w-36 rounded-lg skeleton" /> },
);

export function WalletButton() {
  const id = useIdentity();
  return (
    <div className="flex items-center gap-2">
      {id.isConnected && id.address && (
        <Link href={`/profile/${id.address}`} className="hidden sm:inline text-xs font-bold text-bg/80 hover:text-bg">
          profile
        </Link>
      )}
      <WalletMultiButton />
    </div>
  );
}
