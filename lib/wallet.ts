"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { createRng, fakeAddress } from "./rng";

const DEMO_KEY = "beckpad_demo_wallet";
const EVT = "beckpad:demo-wallet";

function readDemo(): string | null {
  try {
    return localStorage.getItem(DEMO_KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * The identity used for trades / profile. A connected wallet wins; otherwise the
 * user can opt into a per-browser demo wallet so the launchpad works without an extension.
 */
export function useIdentity() {
  const { publicKey, connected, disconnect } = useWallet();
  const demo = useSyncExternalStore(subscribe, readDemo, () => null);

  const enableDemo = useCallback(() => {
    const addr = fakeAddress(createRng(Date.now() & 0xffffffff));
    try {
      localStorage.setItem(DEMO_KEY, addr);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVT));
    return addr;
  }, []);

  const disableDemo = useCallback(() => {
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVT));
  }, []);

  const address = connected && publicKey ? publicKey.toBase58() : demo;
  return {
    address,
    isDemo: !connected && !!demo,
    isConnected: connected,
    enableDemo,
    disableDemo,
    disconnect,
  };
}
