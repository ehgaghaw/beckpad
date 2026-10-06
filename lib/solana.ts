"use client";
import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, type Keypair } from "@solana/web3.js";
import { api } from "./api";
import type { PumpTxRequest } from "@/types";

export const EXPLORER = (sig: string) => `https://solscan.io/tx/${sig}`;

function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Builds a pump.fun transaction server-side, signs it in the connected wallet, sends and confirms it. */
export function usePumpTx() {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useCallback(
    async (req: Omit<PumpTxRequest, "publicKey">, extraSigners: Keypair[] = [], onStatus?: (s: string) => void) => {
      if (!wallet.publicKey || !wallet.sendTransaction) throw new Error("Connect a wallet first");
      onStatus?.("Building transaction…");
      const b64 = await api.buildTx({ ...req, publicKey: wallet.publicKey.toBase58() });
      const tx = VersionedTransaction.deserialize(fromBase64(b64));
      if (extraSigners.length) tx.sign(extraSigners);
      onStatus?.("Approve in your wallet…");
      const signature = await wallet.sendTransaction(tx, connection, { maxRetries: 3, preflightCommitment: "confirmed" });
      onStatus?.("Confirming on Solana…");
      const deadline = Date.now() + 75_000;
      while (Date.now() < deadline) {
        const st = await connection.getSignatureStatuses([signature]);
        const s = st.value[0];
        if (s) {
          if (s.err) throw new Error("Transaction failed on-chain (slippage or insufficient SOL)");
          if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") return signature;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      throw new Error(`Confirmation timed out. Check ${EXPLORER(signature)}`);
    },
    [connection, wallet],
  );
}
