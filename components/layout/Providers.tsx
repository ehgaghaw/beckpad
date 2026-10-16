"use client";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Toaster } from "sonner";
import { useLiveUpdates } from "@/lib/hooks";

/** Mainnet: coins are created and traded on pump.fun's live bonding curve. */
// PublicNode allows browser (CORS) requests; the official public RPC returns 403 to browsers.
const ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://solana-rpc.publicnode.com";

function Live() {
  useLiveUpdates();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Installed Wallet Standard wallets (Phantom, Backpack, …) are auto-detected. Phantom and
  // Solflare are also listed explicitly so they appear with an install link when missing.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={ENDPOINT} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Live />
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: { background: "#0f0d13", border: "1px solid #3a3046", color: "#ece8f2", borderRadius: 2, fontFamily: "var(--font-jet), monospace", fontSize: 12, letterSpacing: "0.04em" },
            }}
          />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
