/**
 * Server-side registry + attribution index for coins launched through BeckPad.
 * The bonding curve itself lives on-chain (pump.fun program); this store keeps
 * metadata, trades that went through BeckPad (verified on-chain), referral
 * links, comments and derived stats. Persisted to DATA_DIR/beckpad.json.
 */
import fs from "fs";
import path from "path";
import { createRng, fakeId } from "./rng";
import { INITIAL_REAL_TOKENS, marketCapOf, priceOf, progressOf, TOTAL_SUPPLY } from "./curve";
import { SOL_USD } from "./format";
import { scoreToGrade, tierForVolume } from "./tiers";
import * as chain from "./chain";
import type {
  Attribution,
  Caller,
  Candle,
  Coin,
  CoinTab,
  Comment,
  CurveSnapshot,
  Holder,
  LiveEvent,
  PrepareLaunchInput,
  Profile,
  Range,
  RecordTradeInput,
  ReferralLink,
  RegisterCoinInput,
  Source,
  SyncResult,
  Trade,
} from "@/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const CURVE_TTL = 12_000;
const HOLDERS_TTL = 45_000;

interface PendingLaunch extends PrepareLaunchInput {
  createdAt: number;
  uri: string;
}

interface World {
  coins: Map<string, Coin>;
  images: Map<string, string>; // mint -> data URL
  pending: Map<string, PendingLaunch>;
  trades: Map<string, Trade[]>; // newest first
  signatures: Set<string>;
  comments: Map<string, Comment[]>;
  candles: Map<string, Candle[]>;
  referralLinks: Map<string, ReferralLink>;
  events: LiveEvent[];
  updatedAt: Map<string, number>;
  holdersCache: Map<string, { at: number; holders: Holder[] }>;
}

/* ----------------------------- persistence ----------------------------- */

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "beckpad.json");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://beckpad-production.up.railway.app").replace(/\/$/, "");

function emptyWorld(): World {
  return {
    coins: new Map(),
    images: new Map(),
    pending: new Map(),
    trades: new Map(),
    signatures: new Set(),
    comments: new Map(),
    candles: new Map(),
    referralLinks: new Map(),
    events: [],
    updatedAt: new Map(),
    holdersCache: new Map(),
  };
}

function load(): World {
  try {
    if (!fs.existsSync(DATA_FILE)) return emptyWorld();
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const w = emptyWorld();
    for (const c of raw.coins ?? []) if (c.curve && c.signature) w.coins.set(c.mint, c);
    for (const [k, v] of raw.images ?? []) w.images.set(k, v);
    for (const [k, v] of raw.pending ?? []) w.pending.set(k, v);
    for (const [k, v] of raw.trades ?? []) w.trades.set(k, v);
    for (const s of raw.signatures ?? []) w.signatures.add(s);
    for (const [k, v] of raw.comments ?? []) w.comments.set(k, v);
    for (const [k, v] of raw.candles ?? []) w.candles.set(k, v);
    for (const [k, v] of raw.referralLinks ?? []) w.referralLinks.set(k, v);
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
        images: Array.from(world.images.entries()),
        pending: Array.from(world.pending.entries()),
        trades: Array.from(world.trades.entries()),
        signatures: Array.from(world.signatures),
        comments: Array.from(world.comments.entries()),
        candles: Array.from(world.candles.entries()),
        referralLinks: Array.from(world.referralLinks.entries()),
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

let solUsd = SOL_USD;
function refreshSolPrice() {
  void chain.solPriceUsd().then((p) => {
    if (p > 0) solUsd = p;
  });
}
refreshSolPrice();

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
  const code = String(ref).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  if (!code) return DIRECT;
  const link = world.referralLinks.get(code);
  return { id: `ref:${code}`, kind: "referral", label: `ref:${code}`, handle: link ? short(link.owner) : undefined };
}

function touch(mint: string) {
  world.updatedAt.set(mint, Date.now());
  save();
}

function isPubkey(s: unknown): s is string {
  return typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

/* ----------------------------- derived data ----------------------------- */

function applyCurve(c: Coin, s: CurveSnapshot) {
  const prevPrice = c.priceSol;
  c.curve = s;
  c.realSol = s.realSol;
  c.priceSol = priceOf(s);
  c.marketCapSol = marketCapOf(s);
  c.marketCapUsd = c.marketCapSol * solUsd;
  c.curvePct = progressOf(s);
  if (s.complete && !c.graduated) {
    c.graduated = true;
    c.graduatedAt = Date.now();
    pushEvent({ id: fakeId(rng), kind: "graduate", mint: c.mint, ticker: c.ticker, emoji: c.emoji, hue: c.hue, ts: Date.now() });
  }
  if (c.priceSol !== prevPrice) {
    updateCandle(c.mint, c.priceSol);
    touch(c.mint);
  }
}

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

function recomputeRug(c: Coin, holders: Holder[]) {
  const dev = holders.find((h) => h.isDev)?.tokens ?? 0;
  const supply = c.curve.totalSupply || TOTAL_SUPPLY;
  const devWalletPct = (dev / supply) * 100;
  const top10 = holders.filter((h) => !h.isCurve).slice(0, 10).reduce((a, b) => a + b.tokens, 0);
  const top10Pct = (top10 / supply) * 100;
  const trades = world.trades.get(c.mint) ?? [];
  const early = new Set(trades.filter((t) => t.side === "buy" && t.wallet !== c.creator && t.ts - c.createdAt < 3000).map((t) => t.wallet));
  const bundledBuys = early.size;
  const bundledDetected = bundledBuys >= 3;
  const devSold = trades.some((t) => t.side === "sell" && t.wallet === c.creator);
  let score = 100 - devWalletPct * 1.6 - Math.max(0, top10Pct - 20) * 0.7 - bundledBuys * 2.5 - (devSold ? 28 : 0) + (c.graduated ? 4 : 0);
  score = Math.round(Math.max(0, Math.min(100, score)));
  const notes: string[] = [];
  if (devSold) notes.push("Dev wallet has sold");
  if (bundledDetected) notes.push(`${bundledBuys} wallets bought within 3s of launch`);
  if (top10Pct > 50) notes.push("Top-10 holders over 50%");
  if (devWalletPct > 15) notes.push("Dev wallet over 15%");
  if (trades.length === 0) notes.push("No BeckPad trades yet");
  if (notes.length === 0) notes.push("No red flags detected");
  c.rug = { devWalletPct: +devWalletPct.toFixed(1), top10Pct: +top10Pct.toFixed(1), bundledBuys, bundledDetected, devSold, devLocked: false, score, grade: scoreToGrade(score), notes };
}

function recomputeStats(c: Coin) {
  const now = Date.now();
  const trades = world.trades.get(c.mint) ?? [];
  c.volume24hSol = trades.filter((t) => now - t.ts < DAY).reduce((a, b) => a + b.sol, 0);
  c.replies = (world.comments.get(c.mint) ?? []).length;
  const candles = world.candles.get(c.mint) ?? [];
  const cutoff = Math.floor((now - DAY) / 1000);
  const ref = candles.find((k) => k.time >= cutoff) ?? candles[0];
  c.change24h = ref && ref.open > 0 ? ((c.priceSol - ref.open) / ref.open) * 100 : 0;
  c.marketCapUsd = c.marketCapSol * solUsd;
}

/* ----------------------------- chain refresh ----------------------------- */

const inflight = new Map<string, Promise<void>>();

async function refreshCurve(c: Coin, force = false) {
  if (!force && Date.now() - c.curve.updatedAt < CURVE_TTL) return;
  if (c.graduated && !force && Date.now() - c.curve.updatedAt < 10 * CURVE_TTL) return;
  let p = inflight.get(c.mint);
  if (!p) {
    p = (async () => {
      try {
        const s = await chain.readCurve(c.mint);
        if (s) applyCurve(c, s);
        else c.curve.updatedAt = Date.now();
      } catch (e) {
        console.error("[store] curve refresh failed", c.mint, e instanceof Error ? e.message : e);
        c.curve.updatedAt = Date.now() - CURVE_TTL + 4000; // back off briefly
      } finally {
        inflight.delete(c.mint);
      }
    })();
    inflight.set(c.mint, p);
  }
  await p;
}

async function refreshHolders(c: Coin, force = false): Promise<Holder[]> {
  const cached = world.holdersCache.get(c.mint);
  if (cached && !force && Date.now() - cached.at < HOLDERS_TTL) return cached.holders;
  try {
    const list = await chain.largestHolders(c.mint);
    const supply = c.curve.totalSupply || TOTAL_SUPPLY;
    const holders: Holder[] = list.map((h) => ({
      wallet: h.owner,
      pct: (h.tokens / supply) * 100,
      tokens: h.tokens,
      isDev: h.owner === c.creator,
      isCurve: h.owner === chain.curvePda(c.mint).toBase58(),
    }));
    if (!holders.some((h) => h.isDev)) {
      const devTokens = await chain.tokenBalance(c.creator, c.mint);
      if (devTokens > 0) holders.push({ wallet: c.creator, pct: (devTokens / supply) * 100, tokens: devTokens, isDev: true, isCurve: false });
    }
    holders.sort((a, b) => b.pct - a.pct);
    world.holdersCache.set(c.mint, { at: Date.now(), holders });
    c.holders = holders.filter((h) => !h.isCurve).length;
    recomputeRug(c, holders);
    return holders;
  } catch (e) {
    console.error("[store] holders refresh failed", c.mint, e instanceof Error ? e.message : e);
    return cached?.holders ?? [];
  }
}

let lastSweep = 0;
/** Keep the most active coins fresh without hammering the RPC. */
function sweep() {
  if (Date.now() - lastSweep < 10_000) return;
  lastSweep = Date.now();
  refreshSolPrice();
  const coins = Array.from(world.coins.values())
    .filter((c) => !c.graduated)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12);
  for (const c of coins) void refreshCurve(c);
}

function pub(c: Coin): Coin {
  recomputeStats(c);
  return c;
}

/* ----------------------------- reads ----------------------------- */

export async function listCoins(tab: CoinTab, limit = 60): Promise<Coin[]> {
  sweep();
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
      out = all.filter((c) => !c.graduated).sort((a, b) => b.volume24hSol - a.volume24hSol || b.marketCapSol - a.marketCapSol || b.createdAt - a.createdAt);
  }
  return out.slice(0, limit);
}

export async function getCoin(mint: string): Promise<Coin | null> {
  const c = world.coins.get(mint);
  if (!c) return null;
  await refreshCurve(c);
  void refreshHolders(c);
  return pub(c);
}

export async function coinOfTheHour(): Promise<Coin | null> {
  sweep();
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

export async function getHolders(mint: string): Promise<Holder[]> {
  const c = world.coins.get(mint);
  if (!c) return [];
  return refreshHolders(c);
}

export function getComments(mint: string): Comment[] {
  return world.comments.get(mint) ?? [];
}

export function getCandles(mint: string): Candle[] {
  return world.candles.get(mint) ?? [];
}

export async function getPosition(wallet: string, mint: string): Promise<number> {
  if (!isPubkey(wallet) || !isPubkey(mint)) return 0;
  return chain.tokenBalance(wallet, mint);
}

export function sync(since: number): SyncResult {
  sweep();
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
  const out: Caller[] = [];
  const startMcap = (30 / 1_073_000_000) * TOTAL_SUPPLY;
  for (const [owner, row] of byOwner) {
    const called = Array.from(row.mints).map((m) => world.coins.get(m)).filter(Boolean) as Coin[];
    const wins = called.filter((c) => c.graduated || c.curvePct >= 10).length;
    let best: Caller["bestCall"] = null;
    for (const c of called) {
      const multiple = Math.max(0.01, c.marketCapSol / startMcap);
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
    pnlSol: +(received - spent).toFixed(3),
    joinedAt: isFinite(first) ? first : Date.now(),
  };
}

/* ----------------------------- metadata hosting ----------------------------- */

export function metadataFor(mint: string) {
  const c = world.coins.get(mint);
  const p = world.pending.get(mint);
  const src = c ?? p;
  if (!src) return null;
  const hasImage = world.images.has(mint);
  return {
    name: src.name,
    symbol: src.ticker,
    description: src.description,
    image: hasImage ? `${SITE_URL}/api/meta/${mint}/image` : undefined,
    showName: true,
    createdOn: "https://pump.fun",
    twitter: src.socials.twitter,
    telegram: src.socials.telegram,
    website: src.socials.website || SITE_URL,
  };
}

export function imageFor(mint: string): { bytes: Buffer; type: string } | null {
  const data = world.images.get(mint);
  if (!data) return null;
  const m = data.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/);
  if (!m) return null;
  return { bytes: Buffer.from(m[2], "base64"), type: m[1] };
}

/* ----------------------------- mutations ----------------------------- */

function pushEvent(e: LiveEvent) {
  world.events.unshift(e);
  if (world.events.length > 300) world.events.length = 300;
}

function updateCandle(mint: string, price: number) {
  if (!(price > 0)) return;
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
    if (candles.length > 2000) candles.splice(0, candles.length - 2000);
  }
  world.candles.set(mint, candles);
}

/** Step 1 of a launch: validate + park metadata so the token URI resolves immediately. */
export async function prepareLaunch(input: PrepareLaunchInput): Promise<{ uri: string; name: string; symbol: string }> {
  if (!isPubkey(input.creator)) throw new Error("Connect a wallet first");
  if (!isPubkey(input.mint)) throw new Error("Invalid mint");
  const ticker = String(input.ticker ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  const name = String(input.name ?? "").trim().slice(0, 32);
  if (ticker.length < 2) throw new Error("Ticker must be 2–10 letters or numbers");
  if (name.length < 2) throw new Error("Name is too short");
  if (input.imageDataUrl && input.imageDataUrl.length > 1_400_000) throw new Error("Image too large (max ~1 MB)");
  if (input.imageDataUrl && !/^data:image\/[a-z+.-]+;base64,/.test(input.imageDataUrl)) throw new Error("Unsupported image");
  const socials = {
    twitter: input.socials?.twitter?.trim() || undefined,
    telegram: input.socials?.telegram?.trim() || undefined,
    website: input.socials?.website?.trim() || undefined,
  };
  // Expire stale pending launches (never registered within an hour)
  for (const [m, p] of world.pending) if (Date.now() - p.createdAt > HOUR && !world.coins.has(m)) {
    world.pending.delete(m);
    world.images.delete(m);
  }
  if (input.imageDataUrl) world.images.set(input.mint, input.imageDataUrl);
  let uri = `${SITE_URL}/api/meta/${input.mint}`;
  try {
    const pinned = await chain.pinToIpfs(name, ticker, String(input.description ?? "").trim().slice(0, 500), input.imageDataUrl, socials);
    if (pinned) uri = pinned;
  } catch (e) {
    console.error("[store] IPFS pin failed, falling back to hosted metadata", e instanceof Error ? e.message : e);
  }
  world.pending.set(input.mint, {
    ...input,
    name,
    ticker,
    description: String(input.description ?? "").trim().slice(0, 500),
    emoji: input.emoji || "🪙",
    socials,
    imageDataUrl: undefined,
    createdAt: Date.now(),
    uri,
  });
  save();
  return { uri, name, symbol: ticker };
}

/** Step 3 of a launch: the create transaction confirmed; verify it and list the coin. */
export async function registerCoin(input: RegisterCoinInput): Promise<Coin> {
  if (!isPubkey(input.mint) || !isPubkey(input.creator)) throw new Error("Invalid request");
  if (world.coins.has(input.mint)) return pub(world.coins.get(input.mint)!);
  const p = world.pending.get(input.mint);
  if (!p) throw new Error("Launch was not prepared on this server");
  if (p.creator !== input.creator) throw new Error("Creator mismatch");
  if (world.signatures.has(input.signature)) throw new Error("Transaction already used");
  const v = await chain.verifyTx(input.signature, input.creator, input.mint);
  if (!v.involvesMint || !v.involvesPump) throw new Error("Transaction did not create this token on pump.fun");
  let curve: CurveSnapshot | null = null;
  for (let i = 0; i < 6 && !curve; i++) {
    curve = await chain.readCurve(input.mint);
    if (!curve) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!curve) throw new Error("Bonding curve not found yet. Retry in a few seconds.");
  const coin: Coin = {
    mint: input.mint,
    name: p.name,
    ticker: p.ticker,
    description: p.description,
    emoji: p.emoji,
    hue: hashStr(p.ticker + input.mint) % 360,
    imageUrl: world.images.has(input.mint) ? `/api/meta/${input.mint}/image` : undefined,
    metadataUri: p.uri,
    signature: input.signature,
    creator: input.creator,
    createdAt: v.blockTime,
    curve,
    realSol: curve.realSol,
    priceSol: priceOf(curve),
    marketCapSol: marketCapOf(curve),
    marketCapUsd: marketCapOf(curve) * solUsd,
    curvePct: progressOf(curve),
    holders: 0,
    volume24hSol: 0,
    change24h: 0,
    replies: 0,
    graduated: curve.complete,
    devLock: false,
    devBuySol: 0,
    socials: p.socials,
    rug: { devWalletPct: 0, top10Pct: 0, bundledBuys: 0, bundledDetected: false, devSold: false, devLocked: false, score: 80, grade: "B", notes: ["Fresh launch"] },
    attribution: [],
    topSource: null,
  };
  world.coins.set(input.mint, coin);
  world.trades.set(input.mint, []);
  world.comments.set(input.mint, []);
  world.pending.delete(input.mint);
  world.signatures.add(input.signature);
  const p0 = (30 / 1_073_000_000);
  const t0 = Math.floor(v.blockTime / 1000);
  world.candles.set(input.mint, [{ time: t0 - (t0 % 300), open: p0, high: Math.max(p0, coin.priceSol), low: Math.min(p0, coin.priceSol), close: coin.priceSol }]);
  pushEvent({ id: fakeId(rng), kind: "launch", mint: input.mint, ticker: coin.ticker, emoji: coin.emoji, hue: coin.hue, ts: v.blockTime });
  if (v.tokenDelta > 0) {
    const devSol = Math.abs(v.solDelta);
    coin.devBuySol = +devSol.toFixed(4);
    const trade: Trade = { id: fakeId(rng), signature: input.signature, mint: input.mint, ticker: coin.ticker, side: "buy", sol: devSol, tokens: v.tokenDelta, wallet: input.creator, ts: v.blockTime, source: DIRECT };
    world.trades.get(input.mint)!.unshift(trade);
    pushEvent({ id: trade.id, kind: "buy", mint: input.mint, ticker: coin.ticker, emoji: coin.emoji, hue: coin.hue, sol: devSol, wallet: input.creator, ts: v.blockTime });
  }
  recomputeAttribution(coin);
  void refreshHolders(coin, true);
  touch(input.mint);
  return pub(coin);
}

/** A buy/sell signed in the browser confirmed on-chain; verify and attribute it. */
export async function recordTrade(input: RecordTradeInput): Promise<{ trade: Trade; coin: Coin; graduated: boolean }> {
  const c = world.coins.get(input.mint);
  if (!c) throw new Error("Coin not found");
  if (!isPubkey(input.wallet)) throw new Error("Connect a wallet first");
  if (!input.signature || world.signatures.has(input.signature)) throw new Error("Transaction already recorded");
  const v = await chain.verifyTx(input.signature, input.wallet, input.mint);
  if (!v.involvesMint) throw new Error("Transaction does not touch this token");
  if (Math.abs(v.tokenDelta) < 1e-9) throw new Error("No token movement in this transaction");
  const side = v.tokenDelta > 0 ? "buy" : "sell";
  const sol = Math.abs(v.solDelta);
  const tokens = Math.abs(v.tokenDelta);
  const source = side === "buy" ? sourceForRef(input.ref) : null;
  if (source && source.kind === "referral") {
    const link = world.referralLinks.get(source.id.slice(4));
    if (link) {
      const prior = (world.trades.get(c.mint) ?? []).some((t) => t.wallet === input.wallet && t.side === "buy");
      link.buys += 1;
      link.volumeSol += sol;
      if (!prior) link.uniqueBuyers += 1;
    }
  }
  const trade: Trade = { id: fakeId(rng), signature: input.signature, mint: c.mint, ticker: c.ticker, side, sol, tokens, wallet: input.wallet, ts: v.blockTime, source };
  const list = world.trades.get(c.mint) ?? [];
  list.unshift(trade);
  list.sort((a, b) => b.ts - a.ts);
  world.trades.set(c.mint, list);
  world.signatures.add(input.signature);
  const wasGraduated = c.graduated;
  await refreshCurve(c, true);
  recomputeAttribution(c);
  void refreshHolders(c, true);
  pushEvent({ id: trade.id, kind: side, mint: c.mint, ticker: c.ticker, emoji: c.emoji, hue: c.hue, sol, wallet: input.wallet, ts: trade.ts });
  touch(c.mint);
  return { trade, coin: pub(c), graduated: c.graduated && !wasGraduated };
}

export function createReferralLink(wallet: string, label: string, mint?: string): ReferralLink {
  if (!isPubkey(wallet)) throw new Error("Connect a wallet first");
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
  if (!isPubkey(wallet)) throw new Error("Connect a wallet first");
  const body = String(text ?? "").trim().slice(0, 280);
  if (body.length < 2) throw new Error("Comment is too short");
  const c: Comment = { id: fakeId(rng), mint, wallet, text: body, ts: Date.now() };
  const list = world.comments.get(mint) ?? [];
  list.unshift(c);
  world.comments.set(mint, list);
  touch(mint);
  return c;
}

export { INITIAL_REAL_TOKENS };
