"use client";
import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, type Connection, type Keypair } from "@solana/web3.js";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Re-stamps transactions with a blockhash fetched from the same RPC that will
 * send them, right before the wallet prompt. PumpPortal stamps the create
 * transaction with a blockhash from its own node, which ours may not know yet
 * or may already consider stale ("Blockhash not found"). Must run before any
 * signature is added, since signatures cover the blockhash.
 */
async function freshen(connection: Connection, txs: VersionedTransaction[]) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  for (const tx of txs) tx.message.recentBlockhash = blockhash;
  return lastValidBlockHeight;
}

/**
 * Sends a signed transaction and keeps re-broadcasting it every 2s until it
 * confirms, fails on-chain, or its blockhash expires. Preflight is skipped:
 * the preflight simulation is what rejected launches with "Blockhash not
 * found" when the RPC node lagged. A real failure still surfaces, from the
 * confirmed status, with the program's own error.
 */
async function sendAndConfirm(connection: Connection, raw: Uint8Array, lastValidBlockHeight: number, onStatus?: (s: string) => void, label = "Confirming on Solana…") {
  const signature = await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 });
  onStatus?.(label);
  const started = Date.now();
  let lastErr: string | null = null;
  while (Date.now() - started < 120_000) {
    try {
      const s = (await connection.getSignatureStatuses([signature])).value[0];
      if (s?.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(s.err)}. Usually not enough SOL for the launch plus the first buy, or the price moved past slippage.`);
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return signature;
      if (!s) {
        const height = await connection.getBlockHeight("confirmed");
        if (height > lastValidBlockHeight) throw new Error("The transaction expired before it landed. Nothing was charged. Please try again.");
        await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
      }
    } catch (e) {
      if (e instanceof Error && /failed on-chain|expired before/.test(e.message)) throw e;
      lastErr = e instanceof Error ? e.message : String(e); // RPC hiccup: keep polling
    }
    await sleep(2000);
  }
  throw new SentButUnconfirmed(signature, `Sent, but confirmation could not be verified${lastErr ? ` (${lastErr.slice(0, 80)})` : ""}. Check ${EXPLORER(signature)}`);
}

/** Has the wallet sign (not send), so every broadcast goes through our own RPC relay. */
async function signOne(wallet: ReturnType<typeof useWallet>, tx: VersionedTransaction) {
  if (!wallet.signTransaction) throw new Error("This wallet cannot sign transactions. Try Phantom or Solflare.");
  return wallet.signTransaction(tx);
}

/**
 * The launch: the create transaction (launcher is the coin's creator and pays
 * for the dev buy) and the fee-share transaction (100% of creator fees to the
 * ZerePad wallet, locked), signed together in one wallet approval when the
 * wallet supports it, then sent in order. `sendFeeShare` alone re-sends just
 * the second one, for a launch whose first transaction already landed.
 */
export function usePumpLaunch() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const sendFeeShare = useCallback(
    async (mint: string, onStatus?: (s: string) => void) => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first");
      onStatus?.("Building fee-share transaction…");
      const tx = VersionedTransaction.deserialize(fromBase64(await api.buildFeeShareTx(mint, wallet.publicKey.toBase58())));
      const lvh = await freshen(connection, [tx]);
      onStatus?.("Approve the fee-share step in your wallet…");
      const signed = await signOne(wallet, tx);
      return sendAndConfirm(connection, signed.serialize(), lvh, onStatus, "Locking creator fees…");
    },
    [connection, wallet],
  );
  const launch = useCallback(
    async (req: Omit<PumpTxRequest, "publicKey">, mintSigner: Keypair, onStatus?: (s: string) => void): Promise<{ createSig: string; feeSig: string | null }> => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first");
      const me = wallet.publicKey.toBase58();
      onStatus?.("Building transactions…");
      const [createB64, feeB64] = await Promise.all([api.buildTx({ ...req, publicKey: me }), api.buildFeeShareTx(mintSigner.publicKey.toBase58(), me)]);
      const createTx = VersionedTransaction.deserialize(fromBase64(createB64));
      const feeTx = VersionedTransaction.deserialize(fromBase64(feeB64));
      const lvh = await freshen(connection, [createTx, feeTx]);
      createTx.sign([mintSigner]);
      onStatus?.("Approve in your wallet…");
      let signedCreate: VersionedTransaction;
      let signedFee: VersionedTransaction | null = null;
      if (wallet.signAllTransactions) [signedCreate, signedFee] = await wallet.signAllTransactions([createTx, feeTx]);
      else signedCreate = await signOne(wallet, createTx);
      const createSig = await sendAndConfirm(connection, signedCreate.serialize(), lvh, onStatus);
      if (!signedFee) return { createSig, feeSig: await sendFeeShare(mintSigner.publicKey.toBase58(), onStatus).catch(() => null) };
      try {
        return { createSig, feeSig: await sendAndConfirm(connection, signedFee.serialize(), lvh, onStatus, "Locking creator fees…") };
      } catch {
        return { createSig, feeSig: null }; // e.g. its blockhash expired while the first one confirmed; the caller re-sends it
      }
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
      if (!wallet.publicKey) throw new Error("Connect a wallet first");
      onStatus?.("Building transaction…");
      const tx = VersionedTransaction.deserialize(fromBase64(await api.buildTx({ ...req, publicKey: wallet.publicKey.toBase58() })));
      const lvh = await freshen(connection, [tx]);
      if (extraSigners.length) tx.sign(extraSigners);
      onStatus?.("Approve in your wallet…");
      const signed = await signOne(wallet, tx);
      return sendAndConfirm(connection, signed.serialize(), lvh, onStatus);
    },
    [connection, wallet],
  );
}
