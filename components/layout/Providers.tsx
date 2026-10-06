"use client";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { Toaster } from "sonner";
import { useLiveUpdates } from "@/lib/hooks";

const ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet");

function Live() {
  useLiveUpdates();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Installed Wallet Standard wallets (Phantom, Backpack, …) are auto-detected. Phantom and
  // Solflare are also listed explicitly so they appear with an install link when missing.
  // The app only ever asks to connect; it never requests a signature, so wallets show the
  // plain connect prompt.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={ENDPOINT}>
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
