"use client";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Toaster } from "sonner";
import { useLiveUpdates } from "@/lib/hooks";

/** Mainnet: coins are created and traded on pump.fun's live bonding curve. */
const ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

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
              style: { background: "#1c1033", border: "2px solid #3d2766", color: "#f6f1ff", boxShadow: "4px 4px 0 0 #000", borderRadius: 6 },
            }}
          />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
