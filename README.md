# BeckPad

Attribution-first Solana memecoin launchpad with a money / gaming aesthetic. Coins are **real SPL tokens on
Solana mainnet**: BeckPad creates them on the pump.fun bonding curve and routes buys/sells through it, with the
connected wallet signing every transaction. BeckPad adds the attribution layer on top.
Every buy on a coin is traced back to the referral link, X post or caller that drove it, so you can see who
actually brings volume and who is just shilling. Callers rank up through gaming tiers on **tracked volume**,
not follower count. A Rug Check grade (A–F) and a visible dev-lock badge sit on every coin.

> BeckPad is a parody/fan concept and is not affiliated with or endorsed by Alex Becker.
> No real person's photo, likeness or quotes are used.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Other scripts: `npm run build` (production build), `npm start` (serve the build), `npm run lint`.

Optional env: copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SOLANA_RPC` (defaults to devnet).

### Trying it without a wallet extension

Phantom, Solflare and Backpack connect through `@solana/wallet-adapter`. Nothing is signed on-chain yet,
so you can also click **Use a demo wallet** in any trade panel; it creates a per-browser address so buys,
sells, launches, comments and referral links all work immediately.

### How a launch works (real, on mainnet)

1. The browser generates a mint keypair and calls `prepareLaunch`: the server parks the metadata and serves it at
   `/api/meta/<mint>` (or pins it to IPFS when `PINATA_JWT` is set).
2. The server asks PumpPortal's local-transaction API for an unsigned `create` transaction (token + curve + dev buy).
3. The browser signs it with the mint keypair and the connected wallet, sends it, and waits for confirmation.
4. `registerCoin` verifies the signature on-chain (signed by the creator, touches the mint and the pump.fun program),
   reads the bonding curve account, and lists the coin.

Buys and sells follow the same pattern (`buildTx` → wallet signs → `recordTrade` verifies the transaction's SOL and
token balance changes on-chain and attributes it to the referral cookie). Nothing is trusted from the client.

### Data

There is no seeded data. The bonding curve, price and holders are read live from Solana (`lib/chain.ts`). BeckPad's
own store (`lib/store.ts`) keeps coin metadata, trades routed through BeckPad, referral links, comments and derived
stats, persisted to `DATA_DIR/beckpad.json`. On Railway the service has a volume at `/data` with `DATA_DIR=/data`.
The browser polls `/api/rpc` (`sync`) every 3s for live updates.

Env: `SOLANA_RPC` (server reads/verification), `NEXT_PUBLIC_SOLANA_RPC` (browser sends transactions), both default to
the public mainnet RPC; use a Helius/Triton/QuickNode URL in production. `NEXT_PUBLIC_SITE_URL` for metadata URIs.
`PINATA_JWT` optional for IPFS metadata.

## What's in Phase 1

| Page | Route | Highlights |
| --- | --- | --- |
| Home | `/` | Coin of the Hour (curve progress + graduation countdown), Money Printer feed, Trending / New / About to Graduate / Graduated tabs, coin cards with Rug Check badge and "top source" chip |
| Coin | `/coin/[mint]` | Candlestick chart (lightweight-charts), buy/sell panel with quotes + slippage, bonding-curve bar, Rug Check panel, **Attribution panel** (sources table + bar chart), holders, live trades, comments |
| Leaderboard | `/leaderboard` | Callers ranked by attributed SOL volume; Bronze → Silver → Gold → Diamond → Whale Tier; 24h / 7d / all filters |
| Launch | `/launch` | Name, ticker, description, image upload, socials, dev buy slider, dev-lock toggle, live preview card, confirm modal |
| Profile | `/profile/[wallet]` | Tier + progress, Degen Score, launches, referral link generator with per-link clicks / buys / buyers / volume |

Global: scrolling live ticker of buys, launches and graduations; wallet connect; toast notifications; loading skeletons and empty states everywhere.

### Referral / attribution logic (mocked)

- Any URL can carry `?ref=CODE`. `components/layout/RefCapture.tsx` stores it in a 30-day cookie and counts the click.
- The trade panel reads the cookie and attaches the code to every buy. `lib/store.ts` credits the buy to that referral
  source, updates the link's stats and recomputes the coin's attribution shares and top source.
- The Caller Leaderboard ranks referral-link owners by the SOL volume their links drove, per 24h / 7d / all-time window.

### Architecture

```
app/                 Next.js App Router pages (client components that load through lib/api.ts)
components/
  layout/            Header, LiveTicker, WalletButton, Footer, Providers (wallet adapter + toaster), RefCapture
  ui/                AnimatedNumber, CurveBar, RugBadge, SourceChip, TierBadge, Tabs, StatBox, Countdown, Modal, skeletons
  coin/              CoinCard, CoinGrid, CoinOfTheHour, MoneyPrinter, PriceChart, TradePanel, RugCheckPanel,
                     AttributionPanel, HolderList, TradeHistory, Comments
  leaderboard/       LeaderboardTable
  launch/            LaunchForm, LaunchPreview
  profile/           ProfileHeader, ReferralLinks
app/api/rpc/         Single JSON-RPC style route backed by lib/store.ts
lib/
  api.ts             The only thing components call (fetches /api/rpc, polls for live updates)
  store.ts           Server-side store: coins, trades, holders, candles, referral links, leaderboard, profiles; JSON persistence
  curve.ts           Constant-product bonding curve maths (shared with the future Anchor program)
  hooks.ts           useAsync, useWorldEvents, useLiveCoin, useLiveFeed, useNow, useGraduationTarget …
  wallet.ts          useIdentity: connected wallet, or a per-browser demo wallet
  referral.ts        ref cookie helpers
  tiers.ts / format.ts / rng.ts
types/index.ts       All shared types (Coin, Trade, Attribution, RugCheck, Caller, Profile, …)
programs/            Phase 2 Anchor program plan
indexer/             Phase 2 indexer plan
```

Trades are simulated off-chain by the store using the same curve maths the on-chain program will use.

### Bonding curve

`lib/curve.ts` mirrors the on-chain design: 1B supply, virtual reserves of 30 SOL / 1.073B tokens, constant
product `k`, 1% fee, graduation when 85 real SOL have been collected (~$75K market cap at $182/SOL).
Buy quotes, sell quotes, price impact and graduation detection all come from there.

## Phase 2 plan

### 1. Anchor program (`programs/bonding-curve`)

Devnet-first. Accounts and instructions are sketched in [programs/bonding-curve/README.md](programs/bonding-curve/README.md):

- `Global` config PDA (fee bps, fee vault, graduation threshold, authority).
- `BondingCurve` PDA per mint holding virtual/real reserves, `complete` flag, creator, dev-lock info.
- Instructions: `initialize`, `create` (mint + metadata + curve ATA + optional dev buy + optional dev lock),
  `buy(sol_in, min_tokens_out, ref_code)`, `sell(tokens_in, min_sol_out)`, `graduate`, `unlock_dev`.
- `ref_code` is carried as an instruction arg / memo so attribution is **on-chain data**, not just a cookie.
- `graduate` moves curve SOL + remaining tokens into a Raydium CPMM / PumpSwap-style pool, burns the LP, and
  flips `complete`. Until then the token's mint and freeze authorities are revoked at `create`.

### 2. Indexer (`indexer`)

A small Node service (Helius webhooks or Geyser → Postgres) described in [indexer/README.md](indexer/README.md):

- Parses `Buy` / `Sell` / `Create` / `Graduate` events, stores trades with their `ref_code`.
- Resolves `ref_code` → owner wallet / caller handle / X post, and keeps rolling attribution tables per coin.
- Computes holder snapshots, Rug Check inputs (dev %, top-10 %, bundle detection from first-slot txs, dev sells),
  caller volume per window and tiers, Degen Scores.
- Exposes the same shape as `lib/api.ts` over REST + a WebSocket for the live ticker.

### 3. Frontend swap

Replace the bodies of `lib/api.ts` functions with fetches to the indexer, and in `TradePanel` / `LaunchForm`
build + sign the Anchor transactions with the connected wallet instead of calling the mock. Component code stays as is.
