"use client";
import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, type Keypair } from "@solana/web3.js";
import { api } from "./api";
import type { PumpTxRequest } from "@/types";

export const EXPLORER = (sig: string) => `https://solscan.io/tx/${sig}`;

/** Thrown when a transaction was sent but confirmation could not be observed. */
export class SentButUnconfirmed extends Error {
  signature: string;
  constructor(signature: string, message: string) {
    super(message);
    this.name = "SentButUnconfirmed";
    this.signature = signature;
  }
}

function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Polls a signature until it confirms; throws on failure, SentButUnconfirmed on timeout. */
async function confirm(connection: ReturnType<typeof useConnection>["connection"], signature: string, onStatus?: (s: string) => void, label = "Confirming on Solana…") {
  onStatus?.(label);
  const deadline = Date.now() + 90_000;
  let lastErr: string | null = null;
  while (Date.now() < deadline) {
    try {
      const s = (await connection.getSignatureStatuses([signature])).value[0];
      if (s) {
        if (s.err) throw new Error("Transaction failed on-chain (slippage or insufficient SOL)");
        if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") return signature;
      }
    } catch (e) {
      if (e instanceof Error && /failed on-chain/.test(e.message)) throw e;
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new SentButUnconfirmed(signature, `Sent, but confirmation could not be verified${lastErr ? ` (${lastErr.slice(0, 80)})` : ""}. Check ${EXPLORER(signature)}`);
}

/**
 * The launch: the create transaction (launcher is the coin's creator and pays
 * for the dev buy) and the fee-share transaction (100% of creator fees to the
 * ZerePad wallet, locked), signed together in one wallet approval when the
 * wallet supports it, then sent in order. `feeShare` alone re-sends just the
 * second one, for a launch whose first transaction already landed.
 */
export function usePumpLaunch() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const sendFeeShare = useCallback(
    async (mint: string, onStatus?: (s: string) => void) => {
      if (!wallet.publicKey || !wallet.sendTransaction) throw new Error("Connect a wallet first");
      onStatus?.("Building fee-share transaction…");
      const tx = VersionedTransaction.deserialize(fromBase64(await api.buildFeeShareTx(mint, wallet.publicKey.toBase58())));
      onStatus?.("Approve the fee-share step in your wallet…");
      const sig = await wallet.sendTransaction(tx, connection, { maxRetries: 3, preflightCommitment: "confirmed" });
      return confirm(connection, sig, onStatus, "Locking creator fees…");
    },
    [connection, wallet],
  );
  const launch = useCallback(
    async (req: Omit<PumpTxRequest, "publicKey">, mintSigner: Keypair, onStatus?: (s: string) => void): Promise<{ createSig: string; feeSig: string | null }> => {
      if (!wallet.publicKey || !wallet.sendTransaction) throw new Error("Connect a wallet first");
      const me = wallet.publicKey.toBase58();
      onStatus?.("Building transactions…");
      const [createB64, feeB64] = await Promise.all([api.buildTx({ ...req, publicKey: me }), api.buildFeeShareTx(mintSigner.publicKey.toBase58(), me)]);
      const createTx = VersionedTransaction.deserialize(fromBase64(createB64));
      const feeTx = VersionedTransaction.deserialize(fromBase64(feeB64));
      createTx.sign([mintSigner]);
      if (wallet.signAllTransactions) {
        onStatus?.("Approve in your wallet…");
        const [signedCreate, signedFee] = await wallet.signAllTransactions([createTx, feeTx]);
        const createSig = await connection.sendRawTransaction(signedCreate.serialize(), { maxRetries: 3, preflightCommitment: "confirmed" });
        await confirm(connection, createSig, onStatus);
        try {
          const feeSig = await connection.sendRawTransaction(signedFee.serialize(), { maxRetries: 3, preflightCommitment: "confirmed" });
          await confirm(connection, feeSig, onStatus, "Locking creator fees…");
          return { createSig, feeSig };
        } catch {
          return { createSig, feeSig: null }; // e.g. its blockhash expired while the first one confirmed; the caller re-sends it
        }
      }
      onStatus?.("Approve the launch in your wallet…");
      const createSig = await wallet.sendTransaction(createTx, connection, { maxRetries: 3, preflightCommitment: "confirmed" });
      await confirm(connection, createSig, onStatus);
      const feeSig = await sendFeeShare(mintSigner.publicKey.toBase58(), onStatus).catch(() => null);
      return { createSig, feeSig };
    },
    [connection, wallet, sendFeeShare],
  );
  return { launch, sendFeeShare };
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
      const deadline = Date.now() + 90_000;
      let lastErr: string | null = null;
      while (Date.now() < deadline) {
        try {
          const st = await connection.getSignatureStatuses([signature]);
          const s = st.value[0];
          if (s) {
            if (s.err) throw new Error("Transaction failed on-chain (slippage or insufficient SOL)");
            if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") return signature;
          }
        } catch (e) {
          if (e instanceof Error && /failed on-chain/.test(e.message)) throw e;
          lastErr = e instanceof Error ? e.message : String(e); // RPC hiccup: keep polling
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      throw new SentButUnconfirmed(signature, `Sent, but confirmation could not be verified${lastErr ? ` (${lastErr.slice(0, 80)})` : ""}. Check ${EXPLORER(signature)}`);
    },
    [connection, wallet],
  );
}
