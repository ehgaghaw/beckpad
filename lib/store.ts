/**
 * Server-side data store. Holds every coin, trade, comment and referral link
 * created on the site, persisted to a JSON file (DATA_DIR/beckpad.json).
 * Nothing is seeded: the site starts empty and fills up as people use it.
 *
 * Phase 2 replaces this with the on-chain program + indexer; the function
 * signatures here are the contract the RPC route and lib/api.ts rely on.
 */
import fs from "fs";
import path from "path";
import { createRng, fakeAddress, fakeId } from "./rng";
import { curveState, GRADUATION_SOL, TOTAL_SUPPLY, quoteBuy, quoteSell } from "./curve";
import { SOL_USD } from "./format";
import { scoreToGrade, tierForVolume } from "./tiers";
import type {
  Attribution,
  Caller,
  Candle,
  Coin,
  CoinTab,
  Comment,
  Holder,
  LaunchInput,
  LiveEvent,
  Profile,
  Range,
  ReferralLink,
  Source,
  SyncResult,
  Trade,
  TradeInput,
} from "@/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface World {
  coins: Map<string, Coin>;
  trades: Map<string, Trade[]>; // newest first
  comments: Map<string, Comment[]>; // newest first
  candles: Map<string, Candle[]>;
  referralLinks: Map<string, ReferralLink>;
  positions: Map<string, Map<string, number>>; // wallet -> mint -> tokens
  events: LiveEvent[]; // newest first
  updatedAt: Map<string, number>; // mint -> last change
}

/* ----------------------------- persistence ----------------------------- */

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "beckpad.json");

function emptyWorld(): World {
  return {
    coins: new Map(),
    trades: new Map(),
    comments: new Map(),
    candles: new Map(),
    referralLinks: new Map(),
    positions: new Map(),
    events: [],
    updatedAt: new Map(),
  };
}

function load(): World {
  try {
    if (!fs.existsSync(DATA_FILE)) return emptyWorld();
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const w = emptyWorld();
    for (const c of raw.coins ?? []) w.coins.set(c.mint, c);
    for (const [k, v] of raw.trades ?? []) w.trades.set(k, v);
    for (const [k, v] of raw.comments ?? []) w.comments.set(k, v);
    for (const [k, v] of raw.candles ?? []) w.candles.set(k, v);
    for (const [k, v] of raw.referralLinks ?? []) w.referralLinks.set(k, v);
    for (const [wallet, entries] of raw.positions ?? []) w.positions.set(wallet, new Map(entries));
    w.events = raw.events ?? [];
    return w;
  } catch (e) {
    console.error("[store] failed to load data file, starting empty", e);
    return emptyWorld();
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const raw = {
        coins: Array.from(world.coins.values()),
        trades: Array.from(world.trades.entries()),
        comments: Array.from(world.comments.entries()),
        candles: Array.from(world.candles.entries()),
        referralLinks: Array.from(world.referralLinks.entries()),
        positions: Array.from(world.positions.entries()).map(([w, m]) => [w, Array.from(m.entries())]),
        events: world.events.slice(0, 300),
      };
      const tmp = DATA_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(raw));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
      console.error("[store] save failed", e);
    }
  }, 400);
}

const g = globalThis as unknown as { __beckpadStore?: World };
const world: World = g.__beckpadStore ?? (g.__beckpadStore = load());
const rng = createRng((Date.now() ^ 0xbec4) >>> 0);

/* ----------------------------- helpers ----------------------------- */

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function short(addr: string) {
  return addr.length > 9 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

function refCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "BECK-";
  for (let i = 0; i < 4; i++) s += chars[rng.int(0, chars.length - 1)];
  return world.referralLinks.has(s) ? refCode() : s;
}

const DIRECT: Source = { id: "direct", kind: "direct", label: "Direct / untracked" };

function sourceForRef(ref?: string | null): Source {
  if (!ref) return DIRECT;
  const code = ref.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  if (!code) return DIRECT;
  const link = world.referralLinks.get(code);
  return { id: `ref:${code}`, kind: "referral", label: `ref:${code}`, handle: link ? short(link.owner) : undefined };
}

function touch(mint: string) {
  world.updatedAt.set(mint, Date.now());
  save();
}

function positionsFor(mint: string): { wallet: string; tokens: number }[] {
  const out: { wallet: string; tokens: number }[] = [];
  for (const [wallet, m] of world.positions) {
    const t = m.get(mint) ?? 0;
    if (t > 1e-6) out.push({ wallet, tokens: t });
  }
  return out.sort((a, b) => b.tokens - a.tokens);
}

/* ----------------------------- derived data ----------------------------- */

function recomputeAttribution(c: Coin) {
  const trades = world.trades.get(c.mint) ?? [];
  const by = new Map<string, { source: Source; buys: number; buyers: Set<string>; vol: number }>();
  for (const t of trades) {
    if (t.side !== "buy") continue;
    const src = t.source ?? DIRECT;
    let row = by.get(src.id);
    if (!row) {
      row = { source: src, buys: 0, buyers: new Set(), vol: 0 };
      by.set(src.id, row);
    }
    row.buys += 1;
    row.buyers.add(t.wallet);
    row.vol += t.sol;
  }
  const total = Array.from(by.values()).reduce((a, b) => a + b.vol, 0) || 1;
  const rows: Attribution[] = Array.from(by.values())
    .map((r) => ({ source: r.source, buys: r.buys, uniqueBuyers: r.buyers.size, volumeSol: r.vol, share: r.vol / total }))
    .sort((a, b) => b.volumeSol - a.volumeSol);
  c.attribution = rows;
  c.topSource = rows.find((r) => r.source.kind !== "direct")?.source ?? null;
}

function recomputeRug(c: Coin) {
  const pos = positionsFor(c.mint);
  const dev = pos.find((p) => p.wallet === c.creator)?.tokens ?? 0;
  const devWalletPct = (dev / TOTAL_SUPPLY) * 100;
  const top10 = pos.slice(0, 10).reduce((a, b) => a + b.tokens, 0);
  const top10Pct = (top10 / TOTAL_SUPPLY) * 100;
  const trades = world.trades.get(c.mint) ?? [];
  const early = new Set(trades.filter((t) => t.side === "buy" && t.wallet !== c.creator && t.ts - c.createdAt < 3000).map((t) => t.wallet));
  const bundledBuys = early.size;
  const bundledDetected = bundledBuys >= 3;
  const devSold = trades.some((t) => t.side === "sell" && t.wallet === c.creator);
  let score = 100 - devWalletPct * 1.6 - Math.max(0, top10Pct - 20) * 0.7 - bundledBuys * 2.5 - (devSold ? 28 : 0) + (c.devLock ? 8 : 0) + (c.graduated ? 4 : 0);
  score = Math.round(Math.max(0, Math.min(100, score)));
  const notes: string[] = [];
  if (c.devLock) notes.push("Dev tokens locked");
  if (devSold) notes.push("Dev wallet has sold");
  if (bundledDetected) notes.push(`${bundledBuys} wallets bought within 3s of launch`);
  if (top10Pct > 50) notes.push("Top-10 holders over 50%");
  if (devWalletPct > 15) notes.push("Dev wallet over 15%");
  if (trades.length === 0) notes.push("No trades yet");
  if (notes.length === 0) notes.push("No red flags detected");
  c.rug = {
    devWalletPct: +devWalletPct.toFixed(1),
    top10Pct: +top10Pct.toFixed(1),
    bundledBuys,
    bundledDetected,
    devSold,
    devLocked: c.devLock,
    score,
    grade: scoreToGrade(score),
    notes,
  };
}

function recomputeStats(c: Coin) {
  if (!c.graduated) {
    const s = curveState(c.realSol);
    c.priceSol = s.priceSol;
    c.marketCapSol = s.marketCapSol;
    c.curvePct = s.pct;
  } else {
    c.marketCapSol = c.priceSol * TOTAL_SUPPLY;
    c.curvePct = 100;
  }
  c.marketCapUsd = c.marketCapSol * SOL_USD;
  const now = Date.now();
  const trades = world.trades.get(c.mint) ?? [];
  c.volume24hSol = trades.filter((t) => now - t.ts < DAY).reduce((a, b) => a + b.sol, 0);
  c.holders = positionsFor(c.mint).length;
  c.replies = (world.comments.get(c.mint) ?? []).length;
  const candles = world.candles.get(c.mint) ?? [];
  const cutoff = Math.floor((now - DAY) / 1000);
  const ref = candles.find((k) => k.time >= cutoff) ?? candles[0];
  c.change24h = ref && ref.open > 0 ? ((c.priceSol - ref.open) / ref.open) * 100 : 0;
}

function refresh(c: Coin) {
  recomputeAttribution(c);
  recomputeRug(c);
  recomputeStats(c);
  return c;
}

function pub(c: Coin): Coin {
  recomputeStats(c);
  return c;
}

/* ----------------------------- reads ----------------------------- */

export function listCoins(tab: CoinTab, limit = 60): Coin[] {
  const all = Array.from(world.coins.values()).map(pub);
  let out: Coin[];
  switch (tab) {
    case "new":
      out = all.filter((c) => !c.graduated).sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "graduating":
      out = all.filter((c) => !c.graduated && c.curvePct >= 60).sort((a, b) => b.curvePct - a.curvePct);
      break;
    case "graduated":
      out = all.filter((c) => c.graduated).sort((a, b) => (b.graduatedAt ?? 0) - (a.graduatedAt ?? 0));
      break;
    default:
      out = all.filter((c) => !c.graduated).sort((a, b) => b.volume24hSol - a.volume24hSol || b.createdAt - a.createdAt);
  }
  return out.slice(0, limit);
}

export function getCoin(mint: string): Coin | null {
  const c = world.coins.get(mint);
  return c ? pub(c) : null;
}

export function coinOfTheHour(): Coin | null {
  const live = Array.from(world.coins.values())
    .map(pub)
    .filter((c) => !c.graduated);
  if (live.length === 0) return null;
  const heat = (c: Coin) => (0.1 + c.volume24hSol) * (0.2 + c.curvePct / 100) * (0.4 + c.rug.score / 100);
  live.sort((a, b) => heat(b) - heat(a));
  return live[0];
}

export function biggestBuys(limit = 10): Trade[] {
  const now = Date.now();
  const all: Trade[] = [];
  for (const list of world.trades.values()) for (const t of list) if (t.side === "buy" && now - t.ts < DAY) all.push(t);
  return all.sort((a, b) => b.sol - a.sol).slice(0, limit);
}

export function recentEvents(limit = 30): LiveEvent[] {
  return world.events.slice(0, limit);
}

export function getTrades(mint: string, limit = 50): Trade[] {
  return (world.trades.get(mint) ?? []).slice(0, limit);
}

export function getHolders(mint: string): Holder[] {
  const c = world.coins.get(mint);
  if (!c) return [];
  const holders: Holder[] = [];
  if (!c.graduated) {
    const unsold = Math.max(0, TOTAL_SUPPLY - curveState(c.realSol).tokensSold);
    holders.push({ wallet: "BondingCurve1111111111111111111111111111111", pct: (unsold / TOTAL_SUPPLY) * 100, tokens: unsold, isDev: false, isCurve: true });
  }
  for (const p of positionsFor(mint).slice(0, 25)) {
    holders.push({ wallet: p.wallet, pct: (p.tokens / TOTAL_SUPPLY) * 100, tokens: p.tokens, isDev: p.wallet === c.creator, isCurve: false });
  }
  return holders.sort((a, b) => b.pct - a.pct);
}

export function getComments(mint: string): Comment[] {
  return world.comments.get(mint) ?? [];
}

export function getCandles(mint: string): Candle[] {
  return world.candles.get(mint) ?? [];
}

export function getPosition(wallet: string, mint: string): number {
  return world.positions.get(wallet)?.get(mint) ?? 0;
}

export function sync(since: number): SyncResult {
  const now = Date.now();
  const events = world.events.filter((e) => e.ts > since);
  const trades: Trade[] = [];
  const coins: Coin[] = [];
  for (const [mint, ts] of world.updatedAt) {
    if (ts <= since) continue;
    const c = world.coins.get(mint);
    if (c) coins.push(pub(c));
    for (const t of world.trades.get(mint) ?? []) {
      if (t.ts > since) trades.push(t);
      else break;
    }
  }
  return { now, events, trades, coins };
}

export function leaderboard(range: Range): Caller[] {
  const now = Date.now();
  const windowMs = range === "24h" ? DAY : range === "7d" ? 7 * DAY : Infinity;
  const byOwner = new Map<string, { vol: Record<Range, number>; buyers: Record<Range, Set<string>>; mints: Set<string>; label: string }>();
  for (const link of world.referralLinks.values()) {
    if (!byOwner.has(link.owner)) {
      byOwner.set(link.owner, { vol: { "24h": 0, "7d": 0, all: 0 }, buyers: { "24h": new Set(), "7d": new Set(), all: new Set() }, mints: new Set(), label: link.label });
    }
  }
  for (const list of world.trades.values()) {
    for (const t of list) {
      if (t.side !== "buy" || !t.source || t.source.kind !== "referral") continue;
      const link = world.referralLinks.get(t.source.id.slice(4));
      if (!link) continue;
      const row = byOwner.get(link.owner)!;
      const age = now - t.ts;
      row.mints.add(t.mint);
      (["24h", "7d", "all"] as Range[]).forEach((r) => {
        const w = r === "24h" ? DAY : r === "7d" ? 7 * DAY : Infinity;
        if (age <= w) {
          row.vol[r] += t.sol;
          row.buyers[r].add(t.wallet);
        }
      });
    }
  }
  void windowMs;
  const out: Caller[] = [];
  for (const [owner, row] of byOwner) {
    const called = Array.from(row.mints).map((m) => world.coins.get(m)).filter(Boolean) as Coin[];
    const wins = called.filter((c) => c.graduated || c.curvePct >= 10).length;
    let best: Caller["bestCall"] = null;
    for (const c of called) {
      const multiple = Math.max(0.01, c.marketCapSol / curveState(0).marketCapSol);
      if (!best || multiple > best.multiple) best = { ticker: c.ticker, mint: c.mint, multiple };
    }
    out.push({
      id: owner,
      handle: owner,
      name: row.label || short(owner),
      hue: hashStr(owner) % 360,
      tier: tierForVolume(row.vol.all),
      volumeSol: row.vol,
      buyers: { "24h": row.buyers["24h"].size, "7d": row.buyers["7d"].size, all: row.buyers.all.size },
      coinsCalled: row.mints.size,
      winRate: called.length ? wins / called.length : 0,
      bestCall: best,
    });
  }
  return out.sort((a, b) => b.volumeSol[range] - a.volumeSol[range]);
}

export function profileFor(wallet: string): Profile {
  const launches = Array.from(world.coins.values())
    .filter((c) => c.creator === wallet)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(pub);
  const links = Array.from(world.referralLinks.values())
    .filter((l) => l.owner === wallet)
    .sort((a, b) => b.volumeSol - a.volumeSol);
  const refVolume = links.reduce((a, b) => a + b.volumeSol, 0);
  const launchVolume = launches.reduce((a, b) => a + b.volume24hSol, 0);
  let tradesCount = 0;
  let spent = 0;
  let received = 0;
  let first = Infinity;
  for (const list of world.trades.values()) {
    for (const t of list) {
      if (t.wallet !== wallet) continue;
      tradesCount += 1;
      first = Math.min(first, t.ts);
      if (t.side === "buy") spent += t.sol;
      else received += t.sol;
    }
  }
  let holdingsValue = 0;
  const pos = world.positions.get(wallet);
  if (pos) for (const [mint, tokens] of pos) holdingsValue += tokens * (world.coins.get(mint)?.priceSol ?? 0);
  for (const c of launches) first = Math.min(first, c.createdAt);
  for (const l of links) first = Math.min(first, l.createdAt);
  const tracked = refVolume + launchVolume * 0.25;
  const degen = Math.min(1000, Math.round(tracked * 0.6 + launches.length * 45 + links.length * 20 + tradesCount * 2));
  return {
    wallet,
    tier: tierForVolume(tracked),
    degenScore: degen,
    trackedVolumeSol: tracked,
    launches,
    referralLinks: links,
    tradesCount,
    pnlSol: +(received + holdingsValue - spent).toFixed(3),
    joinedAt: isFinite(first) ? first : Date.now(),
  };
}

/* ----------------------------- mutations ----------------------------- */

function pushEvent(e: LiveEvent) {
  world.events.unshift(e);
  if (world.events.length > 300) world.events.length = 300;
}

function updateCandle(mint: string, price: number) {
  const candles = world.candles.get(mint) ?? [];
  const now = Math.floor(Date.now() / 1000);
  const bucket = now - (now % 300);
  const last = candles[candles.length - 1];
  if (last && last.time === bucket) {
    last.close = price;
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
  } else {
    const open = last?.close ?? price;
    candles.push({ time: bucket, open, high: Math.max(price, open), low: Math.min(price, open), close: price });
  }
  world.candles.set(mint, candles);
}

export function executeTrade(input: TradeInput): { trade: Trade; coin: Coin; graduated: boolean } {
  const c = world.coins.get(input.mint);
  if (!c) throw new Error("Coin not found");
  if (c.graduated) throw new Error("Coin has graduated. Trade it on the DEX pool.");
  if (!input.wallet) throw new Error("Connect a wallet first");
  const amount = Number(input.amount);
  if (!(amount > 0)) throw new Error(input.side === "buy" ? "Enter a SOL amount" : "Enter a token amount");
  let sol: number;
  let tokens: number;
  let graduated = false;
  let source: Source | null = null;
  const pos = world.positions.get(input.wallet) ?? new Map<string, number>();
  const have = pos.get(c.mint) ?? 0;

  if (input.side === "buy") {
    if (amount > 1000) throw new Error("Max 1000 SOL per buy");
    const q = quoteBuy(c.realSol, amount);
    const minOut = q.tokensOut * (1 - (input.slippagePct ?? 5) / 100);
    if (q.tokensOut < minOut) throw new Error("Slippage exceeded");
    sol = q.solNet + q.feeSol;
    tokens = q.tokensOut;
    c.realSol = q.newRealSol;
    graduated = q.graduates;
    pos.set(c.mint, have + tokens);
    world.positions.set(input.wallet, pos);
    source = sourceForRef(input.ref);
    if (source.kind === "referral") {
      const link = world.referralLinks.get(source.id.slice(4));
      if (link) {
        link.buys += 1;
        link.volumeSol += sol;
        if (have <= 1e-6) link.uniqueBuyers += 1;
      }
    }
  } else {
    if (amount > have + 1e-6) throw new Error("Not enough tokens in this wallet");
    const q = quoteSell(c.realSol, amount);
    sol = q.solOut;
    tokens = q.tokensIn;
    c.realSol = q.newRealSol;
    pos.set(c.mint, Math.max(0, have - tokens));
    world.positions.set(input.wallet, pos);
  }

  if (graduated) {
    c.graduated = true;
    c.graduatedAt = Date.now();
    c.priceSol = curveState(GRADUATION_SOL).priceSol;
  }

  const trade: Trade = {
    id: fakeId(rng),
    mint: c.mint,
    ticker: c.ticker,
    side: input.side,
    sol,
    tokens,
    wallet: input.wallet,
    ts: Date.now(),
    source,
  };
  const list = world.trades.get(c.mint) ?? [];
  list.unshift(trade);
  world.trades.set(c.mint, list);
  refresh(c);
  updateCandle(c.mint, c.priceSol);
  pushEvent({ id: trade.id, kind: trade.side, mint: c.mint, ticker: c.ticker, emoji: c.emoji, hue: c.hue, sol, wallet: input.wallet, ts: trade.ts });
  if (graduated) pushEvent({ id: fakeId(rng), kind: "graduate", mint: c.mint, ticker: c.ticker, emoji: c.emoji, hue: c.hue, ts: Date.now() });
  touch(c.mint);
  return { trade, coin: c, graduated };
}

export function launchCoin(input: LaunchInput): Coin {
  if (!input.creator) throw new Error("Connect a wallet first");
  const ticker = String(input.ticker ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const name = String(input.name ?? "").trim().slice(0, 32);
  if (!ticker || ticker.length < 2) throw new Error("Ticker must be 2–8 letters or numbers");
  if (name.length < 2) throw new Error("Name is too short");
  if (input.imageUrl && input.imageUrl.length > 1_400_000) throw new Error("Image too large (max ~1 MB)");
  const devBuy = Math.max(0, Math.min(20, Number(input.devBuySol) || 0));
  const mint = fakeAddress(rng);
  const now = Date.now();
  const coin: Coin = {
    mint,
    name,
    ticker,
    description: String(input.description ?? "").trim().slice(0, 280),
    emoji: input.emoji || "🪙",
    hue: hashStr(ticker + mint) % 360,
    imageUrl: input.imageUrl || undefined,
    creator: input.creator,
    createdAt: now,
    realSol: 0,
    priceSol: 0,
    marketCapSol: 0,
    marketCapUsd: 0,
    curvePct: 0,
    holders: 0,
    volume24hSol: 0,
    change24h: 0,
    replies: 0,
    graduated: false,
    devLock: !!input.devLock,
    devBuySol: devBuy,
    socials: {
      twitter: input.socials?.twitter?.trim() || undefined,
      telegram: input.socials?.telegram?.trim() || undefined,
      website: input.socials?.website?.trim() || undefined,
    },
    rug: { devWalletPct: 0, top10Pct: 0, bundledBuys: 0, bundledDetected: false, devSold: false, devLocked: !!input.devLock, score: 0, grade: "C", notes: [] },
    attribution: [],
    topSource: null,
  };
  world.coins.set(mint, coin);
  world.trades.set(mint, []);
  world.comments.set(mint, []);
  const p0 = curveState(0).priceSol;
  world.candles.set(mint, [{ time: Math.floor(now / 1000) - (Math.floor(now / 1000) % 300), open: p0, high: p0, low: p0, close: p0 }]);
  refresh(coin);
  pushEvent({ id: fakeId(rng), kind: "launch", mint, ticker, emoji: coin.emoji, hue: coin.hue, ts: now });
  touch(mint);
  if (devBuy > 0) executeTrade({ mint, side: "buy", amount: devBuy, slippagePct: 50, wallet: input.creator, ref: null });
  return coin;
}

export function createReferralLink(wallet: string, label: string, mint?: string): ReferralLink {
  if (!wallet) throw new Error("Connect a wallet first");
  const code = refCode();
  const coin = mint ? world.coins.get(mint) : undefined;
  const link: ReferralLink = {
    code,
    owner: wallet,
    label: String(label ?? "").trim().slice(0, 40) || (coin ? `${coin.ticker} link` : "Site link"),
    mint: coin?.mint,
    ticker: coin?.ticker,
    url: coin ? `/coin/${coin.mint}?ref=${code}` : `/?ref=${code}`,
    clicks: 0,
    buys: 0,
    uniqueBuyers: 0,
    volumeSol: 0,
    createdAt: Date.now(),
  };
  world.referralLinks.set(code, link);
  save();
  return link;
}

export function recordClick(code: string) {
  const link = world.referralLinks.get(String(code ?? "").toUpperCase());
  if (link) {
    link.clicks += 1;
    save();
  }
  return !!link;
}

export function postComment(mint: string, wallet: string, text: string): Comment {
  if (!world.coins.has(mint)) throw new Error("Coin not found");
  if (!wallet) throw new Error("Connect a wallet first");
  const body = String(text ?? "").trim().slice(0, 280);
  if (body.length < 2) throw new Error("Comment is too short");
  const c: Comment = { id: fakeId(rng), mint, wallet, text: body, ts: Date.now() };
  const list = world.comments.get(mint) ?? [];
  list.unshift(c);
  world.comments.set(mint, list);
  touch(mint);
  return c;
}
