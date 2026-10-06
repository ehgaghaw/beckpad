# BeckPad indexer (Phase 2 plan)

Status: **stub / design only**.

Turns on-chain `beckpad_curve` events into the data the frontend already consumes through `lib/api.ts`.

## Pipeline

```
Helius webhook / Geyser gRPC
   → parse Anchor events (Create, Trade, Graduate, DevLock)
   → Postgres (trades, coins, holders_snapshots, sources, referral_links, callers)
   → materialised views (attribution per coin, caller volume per window, rug check)
   → REST  /coins /coins/:mint /coins/:mint/attribution /leaderboard /profile/:wallet
   → WS    /live   (ticker + per-coin updates)
```

## Suggested layout

```
indexer/
  src/
    ingest/       webhook handler, event decoding (Anchor IDL)
    db/           schema.sql, migrations
    jobs/         holder snapshots, rug check, caller tiers, degen score
    api/          REST + WebSocket server matching lib/api.ts
  package.json
```

## Tables (sketch)

- `coins(mint, name, ticker, creator, created_slot, created_at, real_sol, complete, graduated_at, dev_locked, …)`
- `trades(sig, mint, side, wallet, sol, tokens, ref_code, slot, ts)`
- `sources(id, kind, label, handle, url, owner_wallet)` — `ref:` codes, `caller:` handles, `x:` posts
- `referral_links(code, owner_wallet, mint, label, created_at)` + `ref_clicks(code, ts, ua_hash)`
- `holder_snapshots(mint, ts, wallet, amount)`
- `callers(handle, name, hue, …)`

## Derived data

- **Attribution per coin**: group buys by resolved source → buys, unique buyers, volume, share, top source.
- **Rug Check**: dev % (creator balance / supply), top-10 % (latest snapshot), bundled buys (distinct buyers in the
  create slot), dev sold (any creator sell), dev lock (DevLock PDA) → score → A–F grade.
- **Caller tiers**: attributed volume over 24h / 7d / all → Bronze 0, Silver 50, Gold 250, Diamond 1000, Whale 5000 SOL.
- **Degen Score**: tracked volume + launches + links + trade count (same formula as `lib/mock.ts`).

## Click tracking

`/r/:code` endpoint (or the Next.js `RefCapture` component posting to `/api/ref/click`) records a click and
sets the cookie. Buys carry the code on-chain, so conversion = on-chain buys / recorded clicks.
