/**
 * Creator-fee sharing: every coin launched on ZerePad keeps the launcher as
 * its deployer (they sign, pay and hold the dev buy), but sends 100% of its
 * pump.fun creator fees to FEE_WALLET through pump.fun's own fee-sharing
 * program (Pump Fees, pfeeUx…). After the launch lands, a second transaction,
 * signed by the launcher in the same wallet approval:
 *
 *   1. sweep_creator_fee   pays out anything trades already left on the curve
 *                          (setup fails with 6095 while that bucket is non-zero;
 *                          harmless when it is empty)
 *   2. create_fee_sharing_config   the coin's creator becomes the sharing config PDA
 *   3. update_fee_shares   shareholders = [FEE_WALLET 100%]; the program marks the
 *                          admin revoked, so nobody can change the split again
 *
 * Verified by mainnet simulation: shares FEE_WALLET=10000, adminRevoked true,
 * version 2. `isFeeShareLocked` re-checks that state before a coin is listed.
 */
import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PUMP_SDK, feeSharingConfigPda } from "@pump-fun/pump-sdk";
import { connection } from "./chain";

export const FEE_WALLET = new PublicKey(process.env.FEE_WALLET ?? "Bsx8Mtd9tA6j8yWjg5cFejUivZULVJ6oWEhgmdJCL7WV");

/** Unsigned v0 transaction that locks the coin's creator fees to FEE_WALLET. The launcher pays and signs. */
export async function buildFeeShareTx(mintStr: string, launcherStr: string): Promise<string> {
  const mint = new PublicKey(mintStr);
  const launcher = new PublicKey(launcherStr);
  const ixs = [
    await PUMP_SDK.sweepCreatorFeeInstruction({ payer: launcher, mint, creator: launcher, quoteMint: NATIVE_MINT }),
    await PUMP_SDK.createFeeSharingConfig({ creator: launcher, mint, pool: null }),
    await PUMP_SDK.updateFeeShares({ authority: launcher, mint, currentShareholders: [launcher], newShareholders: [{ address: FEE_WALLET, shareBps: 10_000 }], bondingCurveComplete: false }),
  ];
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({ payerKey: launcher, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
}

/** True once the coin's sharing config sends 100% to FEE_WALLET and can no longer be edited. */
export async function isFeeShareLocked(mintStr: string): Promise<boolean> {
  const info = await connection.getAccountInfo(feeSharingConfigPda(new PublicKey(mintStr)), "confirmed");
  if (!info) return false;
  const cfg = PUMP_SDK.decodeSharingConfig(info);
  return cfg.adminRevoked && cfg.shareholders.length === 1 && cfg.shareholders[0].address.equals(FEE_WALLET) && cfg.shareholders[0].shareBps === 10_000;
}
