"use client";
import { useWallet } from "@solana/wallet-adapter-react";

/** The connected wallet identity used for trades, launches, comments and referral links. */
export function useIdentity() {
  const { publicKey, connected, disconnect } = useWallet();
  const address = connected && publicKey ? publicKey.toBase58() : null;
  return { address, isConnected: connected, disconnect };
}
