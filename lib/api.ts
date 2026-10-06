/**
 * Client-side API. Every call goes to /api/rpc, which is backed by lib/store.ts
 * (registry + attribution) and lib/chain.ts (Solana reads, PumpPortal tx builder).
 * Live updates are polled through `sync` and fanned out to subscribers.
 */
import { quoteBuy, quoteSell } from "./curve";
import type {
  Caller,
  Candle,
  Coin,
  CoinTab,
  Comment,
  CreatorFees,
  Holder,
  LiveEvent,
  PrepareLaunchInput,
  Profile,
  PumpTxRequest,
  Quote,
  Range,
  RecordTradeInput,
  ReferralLink,
  RegisterCoinInput,
  SyncResult,
  Trade,
} from "@/types";

export type WorldEvent = { type: "live"; event: LiveEvent } | { type: "coin"; coin: Coin } | { type: "trade"; trade: Trade };

async function rpc<T>(method: string, ...params: unknown[]): Promise<T> {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  const json = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as { ok: boolean; result?: T; error?: string };
  if (!json.ok) throw new Error(json.error ?? "Request failed");
  return json.result as T;
}

/* ----------------------------- live updates ----------------------------- */

const listeners = new Set<(e: WorldEvent) => void>();
function emit(e: WorldEvent) {
  for (const l of listeners) l(e);
}

const poll = { since: 0, timer: 0 as number | undefined, running: false, seen: new Set<string>() };

async function pollOnce() {
  if (poll.running) return;
  poll.running = true;
  try {
    const s = await rpc<SyncResult>("sync", poll.since);
    poll.since = s.now;
    for (const e of s.events) if (remember("e" + e.id)) emit({ type: "live", event: e });
    for (const t of s.trades) if (remember("t" + t.id)) emit({ type: "trade", trade: t });
    for (const c of s.coins) emit({ type: "coin", coin: c });
  } catch {
    /* offline or server restarting; try again next tick */
  } finally {
    poll.running = false;
  }
}

function remember(id: string) {
  if (poll.seen.has(id)) return false;
  poll.seen.add(id);
  if (poll.seen.size > 2000) poll.seen = new Set(Array.from(poll.seen).slice(-1000));
  return true;
}

function schedule(ms: number) {
  if (poll.timer) window.clearTimeout(poll.timer);
  poll.timer = window.setTimeout(async () => {
    await pollOnce();
    schedule(3000);
  }, ms);
}

function pollNow() {
  schedule(0);
}

export const api = {
  listCoins: (tab: CoinTab, limit = 60) => rpc<Coin[]>("listCoins", tab, limit),
  getCoin: (mint: string) => rpc<Coin | null>("getCoin", mint),
  getCoinOfTheHour: () => rpc<Coin | null>("getCoinOfTheHour"),
  getMoneyPrinter: (limit = 10) => rpc<Trade[]>("getMoneyPrinter", limit),
  getRecentEvents: (limit = 30) => rpc<LiveEvent[]>("getRecentEvents", limit),
  getTrades: (mint: string, limit = 50) => rpc<Trade[]>("getTrades", mint, limit),
  getHolders: (mint: string) => rpc<Holder[]>("getHolders", mint),
  getComments: (mint: string) => rpc<Comment[]>("getComments", mint),
  getCandles: (mint: string) => rpc<Candle[]>("getCandles", mint),
  /** On-chain token balance of a wallet */
  getPosition: (wallet: string, mint: string) => rpc<number>("getPosition", wallet, mint),
  getLeaderboard: (range: Range) => rpc<Caller[]>("getLeaderboard", range),
  getProfile: (wallet: string) => rpc<Profile>("getProfile", wallet),

  /** Build an unsigned pump.fun transaction (base64) to sign in the wallet. */
  buildTx: (req: PumpTxRequest) => rpc<string>("buildTx", req),

  /** Creator fees waiting in the pump.fun creator vault for this wallet. */
  getCreatorFees: (wallet: string) => rpc<CreatorFees>("getCreatorFees", wallet),

  prepareLaunch: (input: PrepareLaunchInput) => rpc<{ uri: string; name: string; symbol: string }>("prepareLaunch", input),

  async registerCoin(input: RegisterCoinInput) {
    const c = await rpc<Coin>("registerCoin", input);
    pollNow();
    return c;
  },

  async recordTrade(input: RecordTradeInput) {
    const r = await rpc<{ trade: Trade; coin: Coin; graduated: boolean }>("recordTrade", input);
    pollNow();
    return r;
  },

  async postComment(mint: string, wallet: string, text: string) {
    const c = await rpc<Comment>("postComment", mint, wallet, text);
    pollNow();
    return c;
  },

  createReferralLink: (wallet: string, label: string, mint?: string) => rpc<ReferralLink>("createReferralLink", wallet, label, mint),

  recordRefClick(code: string) {
    rpc<boolean>("recordRefClick", code).catch(() => {});
  },

  /** Synchronous quote preview from the coin's latest on-chain curve snapshot. */
  getQuote(coin: Coin, side: "buy" | "sell", amount: number, slippagePct: number): Quote | null {
    if (coin.graduated || !(amount > 0)) return null;
    if (side === "buy") {
      const q = quoteBuy(coin.curve, amount);
      return {
        side,
        inputAmount: amount,
        outputTokens: q.tokensOut,
        outputSol: 0,
        priceImpactPct: q.priceImpactPct,
        pricePerTokenSol: q.solNet / Math.max(q.tokensOut, 1e-9),
        minReceived: q.tokensOut * (1 - slippagePct / 100),
        feeSol: q.feeSol,
        graduates: q.graduates,
      };
    }
    const q = quoteSell(coin.curve, amount);
    return {
      side,
      inputAmount: amount,
      outputTokens: 0,
      outputSol: q.solOut,
      priceImpactPct: q.priceImpactPct,
      pricePerTokenSol: q.solOut / Math.max(q.tokensIn, 1e-9),
      minReceived: q.solOut * (1 - slippagePct / 100),
      feeSol: q.feeSol,
      graduates: false,
    };
  },

  subscribe(listener: (e: WorldEvent) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Start polling for live updates (idempotent, client only). */
  startLive() {
    if (typeof window === "undefined" || poll.timer) return;
    poll.since = Date.now() - 10_000;
    schedule(1000);
  },
};

export type Api = typeof api;
