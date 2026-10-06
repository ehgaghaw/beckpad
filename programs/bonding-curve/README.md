# `beckpad_curve` — Anchor program (Phase 2 plan)

Status: **stub / design only**. Nothing here is deployed. `lib/curve.ts` in the web app is the reference
implementation of the maths and must stay in sync with this program.

## Layout (when scaffolded with `anchor init`)

```
programs/bonding-curve/
  Anchor.toml
  Cargo.toml
  programs/beckpad_curve/src/
    lib.rs            entrypoint + instructions
    state.rs          Global, BondingCurve, DevLock accounts
    curve.rs          constant-product maths (ported from lib/curve.ts)
    errors.rs
    events.rs         TradeEvent, CreateEvent, GraduateEvent
  tests/              ts-mocha tests against localnet / devnet
```

## Parameters

| Name | Value |
| --- | --- |
| Total supply | 1,000,000,000 (6 decimals) |
| Initial virtual SOL | 30 SOL |
| Initial virtual tokens | 1,073,000,000 |
| Graduation threshold | 85 real SOL |
| Fee | 100 bps on buys and sells → fee vault |
| Dev lock | optional; 90 days, enforced by a `DevLock` PDA holding the creator's tokens |

## Accounts

- `Global` (PDA `["global"]`): authority, fee_vault, fee_bps, graduation_sol, virtual_sol_initial, virtual_token_initial.
- `BondingCurve` (PDA `["curve", mint]`): mint, creator, virtual_sol, virtual_tokens, real_sol, real_tokens,
  complete, created_slot, dev_locked, total_buys, total_sells.
- `DevLock` (PDA `["devlock", mint]`): creator, amount, unlock_ts.
- Curve token vault: ATA of the `BondingCurve` PDA for `mint`. SOL is held on the curve PDA itself.

## Instructions

| Instruction | Args | Notes |
| --- | --- | --- |
| `initialize` | fee_bps, graduation_sol | once, by authority |
| `create` | name, symbol, uri, dev_buy_lamports, dev_lock | creates mint, Metaplex metadata, curve + vault, mints full supply to vault, revokes mint/freeze authority, runs the dev buy in-tx, optionally transfers dev tokens into `DevLock` |
| `buy` | sol_in, min_tokens_out, ref_code: [u8; 8] | fee → vault, tokens from vault to buyer ATA, clamps at graduation threshold, emits `TradeEvent { ref_code }` |
| `sell` | tokens_in, min_sol_out | reverse; rejects when `complete` |
| `graduate` | — | permissionless once `real_sol >= graduation_sol`: creates Raydium CPMM pool (or PumpSwap-style AMM) with curve SOL + remaining tokens, burns LP, sets `complete` |
| `unlock_dev` | — | after `unlock_ts`, returns locked tokens to creator |

## Attribution on-chain

`ref_code` rides inside the `buy` instruction and is emitted in `TradeEvent`. The indexer maps codes to
owners / callers / X posts. Because the code is in the transaction, attribution survives cookie loss and can
be verified by anyone.

## Rug Check inputs produced on-chain

- `created_slot` + first-slot buyer list → bundle detection.
- `DevLock` presence → dev-locked badge.
- Creator ATA balance over time (indexer) → dev %, dev sold flag.

## Tests to write

1. Buy/sell round trip matches `lib/curve.ts` quotes to the lamport.
2. Buy that crosses the threshold is clamped and flips `complete`.
3. Sell after `complete` fails; `graduate` succeeds exactly once.
4. Dev lock prevents transfer until `unlock_ts`.
