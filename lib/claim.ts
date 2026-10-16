/**
 * Claim-and-forward for creator fees. For a wallet that holds creator fees
 * (the ZerePad fee wallet), builds ONE unsigned transaction that:
 *
 *   1. pays out each ZerePad coin's fee-sharing vault to its shareholders
 *      (sweep + distribute_creator_fees, permissionless),
 *   2. claims the wallet's own pump.fun creator vault (collect_creator_fee),
 *   3. transfers exactly what steps 1–2 added to the wallet on to `to`,
 *      or, with `sweepAll`, the wallet's entire balance minus the network fee.
 *
 * The amount in step 3 is measured, not guessed: the claim-only transaction is
 * simulated first and the wallet's balance change read from the result. The
 * wallet's owner signs it; the site never holds a key.
 */
import { ComputeBudgetProgram, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, type TransactionInstruction } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK, feeSharingConfigPda } from "@pump-fun/pump-sdk";
import { connection } from "./chain";
import { listCoins, REMOVED_MINTS } from "./store";

const CU_LIMIT = 600_000;
const CU_PRICE = 50_000; // micro-lamports per CU
const NETWORK_FEE = 5_000 + Math.ceil((CU_LIMIT * CU_PRICE) / 1_000_000);

export type ClaimPlan = {
  tx: string | null;
  claimableSol: number;
  sendSol: number;
  sources: Array<{ label: string; sol: number }>;
  note?: string;
};

async function compile(payer: PublicKey, ixs: TransactionInstruction[]) {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: CU_PRICE }), ...ixs],
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}

/** Lamports the owner's balance changes by when `ixs` run (simulated, nothing sent). */
async function simulatedDelta(owner: PublicKey, ixs: TransactionInstruction[]) {
  const tx = await compile(owner, ixs);
  const before = await connection.getBalance(owner, "confirmed");
  const sim = await connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true, accounts: { encoding: "base64", addresses: [owner.toBase58()] } });
  if (sim.value.err) throw new Error(`Claim simulation failed: ${JSON.stringify(sim.value.err)} ${(sim.value.logs ?? []).slice(-3).join(" | ")}`);
  const after = sim.value.accounts?.[0]?.lamports ?? before;
  return { before, after };
}

export async function buildClaimTx(ownerStr: string, toStr: string, sweepAll = false): Promise<ClaimPlan> {
  const owner = new PublicKey(ownerStr);
  const to = new PublicKey(toStr);
  if (owner.equals(to)) throw new Error("Destination is the same wallet");
  const online = new OnlinePumpSdk(connection);
  const ixs: TransactionInstruction[] = [];
  const sources: ClaimPlan["sources"] = [];

  // 1) every ZerePad coin whose fee-sharing config pays this wallet
  // listed coins plus removed ones: a removed coin's fee split still pays out on-chain
  const coins = [...(await listCoins("new", 200)), ...(await listCoins("graduated", 200)), ...[...REMOVED_MINTS].map((mint) => ({ mint, ticker: mint.slice(0, 4) + "…" }))];
  const seen = new Set<string>();
  for (const c of coins) {
    if (seen.has(c.mint)) continue;
    seen.add(c.mint);
    const mint = new PublicKey(c.mint);
    const info = await connection.getAccountInfo(feeSharingConfigPda(mint), "confirmed");
    if (!info) continue;
    const cfg = PUMP_SDK.decodeSharingConfig(info);
    if (!cfg.shareholders.some((h) => h.address.equals(owner))) continue;
    try {
      const d = await online.buildDistributeCreatorFeesInstructions(mint, { payer: owner });
      const probe = await simulatedDelta(owner, d.instructions).catch(() => null);
      const gained = probe ? probe.after - probe.before + NETWORK_FEE : 0;
      if (gained <= 0) continue; // nothing to distribute yet
      ixs.push(...d.instructions);
      sources.push({ label: `$${c.ticker} fee share`, sol: gained / 1e9 });
    } catch {
      /* below the minimum distributable amount, or nothing there: skip */
    }
  }

  // 2) the wallet's own creator vault (fees from coins it created directly, e.g. a first buy)
  const collect = await online.collectCoinCreatorFeeInstructions(owner, owner);
  const own = await simulatedDelta(owner, collect).catch(() => null);
  const ownGain = own ? own.after - own.before + NETWORK_FEE : 0;
  if (ownGain > 0) {
    ixs.push(...collect);
    sources.push({ label: "creator vault", sol: ownGain / 1e9 });
  }

  if (!ixs.length && !sweepAll) return { tx: null, claimableSol: 0, sendSol: 0, sources, note: "Nothing to claim right now." };

  // 3) measure the real gain of everything together, then forward it
  const { before, after } = ixs.length ? await simulatedDelta(owner, ixs) : { before: await connection.getBalance(owner, "confirmed"), after: 0 };
  const end = ixs.length ? after : before;
  const claimed = Math.max(0, end - before + NETWORK_FEE);
  // `end` already has the network fee taken off, so sending all of it leaves exactly 0
  // (a system account may not keep a balance between 0 and the rent minimum).
  // with claim instructions, `end` is a simulated balance that already paid the network fee; without any, it is
  // the current balance, so the fee still has to come out of it
  const send = sweepAll ? (ixs.length ? end : end - NETWORK_FEE) : claimed - NETWORK_FEE;
  if (send <= 0) return { tx: null, claimableSol: claimed / 1e9, sendSol: 0, sources, note: "The claimable amount does not cover the network fee yet." };
  const tx = await compile(owner, [...ixs, SystemProgram.transfer({ fromPubkey: owner, toPubkey: to, lamports: send })]);
  if ((tx.serialize().length ?? 0) > 1232) throw new Error("Too many coins to claim in one transaction");
  return { tx: Buffer.from(tx.serialize()).toString("base64"), claimableSol: claimed / 1e9, sendSol: send / 1e9, sources };
}
