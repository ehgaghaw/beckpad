/**
 * Server-side Solana access: reads pump.fun bonding curves, token holders and
 * balances, verifies confirmed transactions, and builds trade/create transactions
 * through PumpPortal's local transaction API (signed later in the browser).
 */
import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import type { CurveSnapshot, PumpTxRequest } from "@/types";

export const RPC_URL = process.env.SOLANA_RPC ?? process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
export const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMPPORTAL = "https://pumpportal.fun/api/trade-local";
const DECIMALS = 6;

const g = globalThis as unknown as { __beckpadConn?: Connection };
export const connection: Connection = g.__beckpadConn ?? (g.__beckpadConn = new Connection(RPC_URL, "confirmed"));

export function curvePda(mint: string) {
  return PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), new PublicKey(mint).toBuffer()], PUMP_PROGRAM)[0];
}

function u64(buf: Buffer, offset: number) {
  return Number(buf.readBigUInt64LE(offset));
}

/** Decode the BondingCurve account: discriminator + 5×u64 + bool. */
export async function readCurve(mint: string): Promise<CurveSnapshot | null> {
  const info = await connection.getAccountInfo(curvePda(mint), "confirmed");
  if (!info || info.data.length < 49) return null;
  const d = info.data;
  return {
    vTokens: u64(d, 8) / 10 ** DECIMALS,
    vSol: u64(d, 16) / 1e9,
    realTokens: u64(d, 24) / 10 ** DECIMALS,
    realSol: u64(d, 32) / 1e9,
    totalSupply: u64(d, 40) / 10 ** DECIMALS,
    complete: d[48] === 1,
    updatedAt: Date.now(),
  };
}

export interface ChainHolder {
  owner: string;
  tokenAccount: string;
  tokens: number;
}

/** Top-20 token accounts with their owners (2 RPC calls). */
export async function largestHolders(mint: string): Promise<ChainHolder[]> {
  const largest = await connection.getTokenLargestAccounts(new PublicKey(mint), "confirmed");
  const accounts = largest.value.filter((a) => (a.uiAmount ?? 0) > 0);
  if (accounts.length === 0) return [];
  const parsed = await connection.getMultipleParsedAccounts(
    accounts.map((a) => a.address),
    { commitment: "confirmed" },
  );
  return accounts.map((a, i) => {
    const acc = parsed.value[i];
    const data = acc && "parsed" in acc.data ? (acc.data.parsed as { info?: { owner?: string } }) : null;
    return { owner: data?.info?.owner ?? a.address.toBase58(), tokenAccount: a.address.toBase58(), tokens: a.uiAmount ?? 0 };
  });
}

export async function tokenBalance(wallet: string, mint: string): Promise<number> {
  try {
    const res = await connection.getParsedTokenAccountsByOwner(new PublicKey(wallet), { mint: new PublicKey(mint) }, "confirmed");
    return res.value.reduce((sum, a) => sum + (a.account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
  } catch {
    return 0;
  }
}

export interface VerifiedTx {
  signature: string;
  blockTime: number;
  /** SOL change for the wallet (negative on buys), fees included */
  solDelta: number;
  /** Token change for the wallet (positive on buys) */
  tokenDelta: number;
  involvesMint: boolean;
  involvesPump: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch a confirmed transaction and measure what it did to `wallet` for `mint`. */
export async function verifyTx(signature: string, wallet: string, mint: string): Promise<VerifiedTx> {
  let tx: ParsedTransactionWithMeta | null = null;
  for (let i = 0; i < 8 && !tx; i++) {
    tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    if (!tx) await sleep(1500);
  }
  if (!tx || !tx.meta) throw new Error("Transaction not found yet. Wait a few seconds and retry.");
  if (tx.meta.err) throw new Error("Transaction failed on-chain");
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const idx = keys.indexOf(wallet);
  if (idx === -1) throw new Error("Transaction was not signed by this wallet");
  const solDelta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1e9;
  const pre = (tx.meta.preTokenBalances ?? []).filter((b) => b.mint === mint && b.owner === wallet).reduce((s, b) => s + (b.uiTokenAmount.uiAmount ?? 0), 0);
  const post = (tx.meta.postTokenBalances ?? []).filter((b) => b.mint === mint && b.owner === wallet).reduce((s, b) => s + (b.uiTokenAmount.uiAmount ?? 0), 0);
  return {
    signature,
    blockTime: (tx.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
    solDelta,
    tokenDelta: post - pre,
    involvesMint: keys.includes(mint),
    involvesPump: keys.includes(PUMP_PROGRAM.toBase58()),
  };
}

export function creatorVaultPda(creator: string) {
  return PublicKey.findProgramAddressSync([Buffer.from("creator-vault"), new PublicKey(creator).toBuffer()], PUMP_PROGRAM)[0];
}

/** Claimable creator fees sitting in the pump.fun creator vault (lamports minus rent). */
export async function creatorVaultBalance(creator: string): Promise<{ claimableSol: number; vault: string }> {
  const vault = creatorVaultPda(creator);
  const [lamports, rent] = await Promise.all([connection.getBalance(vault, "confirmed"), connection.getMinimumBalanceForRentExemption(0)]);
  return { claimableSol: Math.max(0, lamports - rent) / 1e9, vault: vault.toBase58() };
}

/** Ask PumpPortal for an unsigned transaction; returns base64 bytes. */
export async function buildPumpTx(req: PumpTxRequest): Promise<string> {
  const body =
    req.action === "collectCreatorFee"
      ? { publicKey: req.publicKey, action: "collectCreatorFee", priorityFee: req.priorityFee ?? 0.0003 }
      : {
          publicKey: req.publicKey,
          action: req.action,
          mint: req.mint,
          amount: req.amount,
          denominatedInSol: req.denominatedInSol ? "true" : "false",
          slippage: req.slippage,
          priorityFee: req.priorityFee ?? 0.0005,
          pool: "pump",
          ...(req.action === "create" ? { tokenMetadata: req.tokenMetadata } : {}),
        };
  const res = await fetch(PUMPPORTAL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not build transaction (${res.status}): ${text.slice(0, 200) || res.statusText}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return Buffer.from(bytes).toString("base64");
}

let solPriceCache = { usd: 0, at: 0 };
/** SOL/USD from CoinGecko, cached for 60s. Returns 0 if unavailable. */
export async function solPriceUsd(): Promise<number> {
  if (Date.now() - solPriceCache.at < 60_000) return solPriceCache.usd;
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { signal: AbortSignal.timeout(4000) });
    const j = (await r.json()) as { solana?: { usd?: number } };
    if (j.solana?.usd) solPriceCache = { usd: j.solana.usd, at: Date.now() };
    else solPriceCache.at = Date.now() - 45_000;
  } catch {
    solPriceCache.at = Date.now() - 45_000; // retry in 15s
  }
  return solPriceCache.usd;
}

/** Optional: pin image + metadata to IPFS through Pinata when PINATA_JWT is configured. */
export async function pinToIpfs(name: string, symbol: string, description: string, imageDataUrl: string | undefined, socials: Record<string, string | undefined>): Promise<string | null> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;
  const upload = async (file: Blob, filename: string) => {
    const fd = new FormData();
    fd.append("network", "public");
    fd.append("file", file, filename);
    const r = await fetch("https://uploads.pinata.cloud/v3/files", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: fd });
    if (!r.ok) throw new Error("IPFS upload failed");
    const j = (await r.json()) as { data: { cid: string } };
    return `https://ipfs.io/ipfs/${j.data.cid}`;
  };
  let image: string | undefined;
  if (imageDataUrl) {
    const m = imageDataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (m) image = await upload(new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), "image");
  }
  const meta = { name, symbol, description, image, showName: true, createdOn: "https://pump.fun", ...socials };
  return upload(new Blob([JSON.stringify(meta)], { type: "application/json" }), "metadata.json");
}
