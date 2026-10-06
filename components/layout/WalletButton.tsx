"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useIdentity } from "@/lib/wallet";
import { shortAddr } from "@/lib/format";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false, loading: () => <div className="h-10 w-36 rounded-lg skeleton" /> },
);

export function WalletButton() {
  const id = useIdentity();
  if (id.isDemo && id.address) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/profile/${id.address}`}
          className="h-10 px-3 rounded-md border-2 border-bg text-bg font-display font-bold text-base tracking-wider flex items-center gap-2 hover:bg-bg/10 shadow-[3px_3px_0_0_#651a81]"
          title="Demo wallet (no extension needed)"
        >
          <span className="w-2 h-2 rounded-full bg-ice animate-pulse" />
          <span className="whitespace-nowrap">
            DEMO <span className="hidden sm:inline">{shortAddr(id.address, 3)}</span>
          </span>
        </Link>
        <button
          onClick={id.disableDemo}
          className="h-10 px-1.5 sm:px-2 rounded-md border-2 border-bg/40 text-bg/70 text-xs hover:text-bg"
          title="Exit demo wallet"
        >
          ✕
        </button>
      </div>
    );
  }
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
