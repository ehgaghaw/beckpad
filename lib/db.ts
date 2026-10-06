/**
 * Persistence backend for lib/store.ts.
 *
 * With DATABASE_URL set (Railway Postgres) every coin, trade, comment, candle,
 * referral link, pending launch, image and live event is a row in Postgres, so
 * launches survive redeploys, restarts and volume loss. Writes are diffed
 * against what was last written, so a save only touches rows that changed.
 *
 * Without DATABASE_URL (local dev) the store falls back to a single JSON file
 * in DATA_DIR, which is also what the Postgres backend imports from on its very
 * first boot so existing launches carry over.
 */
import fs from "fs";
import path from "path";
import { Pool, type QueryResultRow } from "pg";
import type { Candle, Coin, Comment, LiveEvent, ReferralLink, Trade } from "@/types";

export interface RawWorld {
  coins: Coin[];
  images: [string, string][];
  pending: [string, unknown][];
  trades: [string, Trade[]][];
  signatures: string[];
  comments: [string, Comment[]][];
  candles: [string, Candle[]][];
  referralLinks: [string, ReferralLink][];
  events: LiveEvent[];
}

export function emptyRaw(): RawWorld {
  return { coins: [], images: [], pending: [], trades: [], signatures: [], comments: [], candles: [], referralLinks: [], events: [] };
}

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "beckpad.json");
const DATABASE_URL = process.env.DATABASE_URL;

export const backendName = DATABASE_URL ? "postgres" : "json-file";

/* ----------------------------- JSON file backend ----------------------------- */

function readFile(): RawWorld | null {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { ...emptyRaw(), ...raw };
  } catch (e) {
    console.error("[db] failed to read data file", e);
    return null;
  }
}

function writeFile(raw: RawWorld) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(raw));
  fs.renameSync(tmp, DATA_FILE);
}

/* ----------------------------- Postgres backend ----------------------------- */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS coins (
  mint text PRIMARY KEY,
  creator text NOT NULL,
  ticker text NOT NULL,
  created_at bigint NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coins_creator_idx ON coins (creator);
CREATE TABLE IF NOT EXISTS coin_images (mint text PRIMARY KEY, data_url text NOT NULL);
CREATE TABLE IF NOT EXISTS pending_launches (mint text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS trades (
  id text PRIMARY KEY,
  mint text NOT NULL,
  ts bigint NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS trades_mint_ts_idx ON trades (mint, ts DESC);
CREATE TABLE IF NOT EXISTS used_signatures (signature text PRIMARY KEY);
CREATE TABLE IF NOT EXISTS comments (
  id text PRIMARY KEY,
  mint text NOT NULL,
  ts bigint NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_mint_ts_idx ON comments (mint, ts DESC);
CREATE TABLE IF NOT EXISTS candles (
  mint text NOT NULL,
  time bigint NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (mint, time)
);
CREATE TABLE IF NOT EXISTS referral_links (code text PRIMARY KEY, owner text NOT NULL, data jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS referral_links_owner_idx ON referral_links (owner);
CREATE TABLE IF NOT EXISTS live_events (id text PRIMARY KEY, ts bigint NOT NULL, data jsonb NOT NULL);
`;

type Row = { key: string; cols: unknown[]; json: string };

interface TableSpec {
  table: string;
  /** Column names, key column(s) first. */
  columns: string[];
  /** Key columns (subset of `columns`) used for ON CONFLICT and DELETE. */
  keys: string[];
  rows: (raw: RawWorld) => Row[];
}

const TABLES: TableSpec[] = [
  {
    table: "coins",
    columns: ["mint", "creator", "ticker", "created_at", "data"],
    keys: ["mint"],
    rows: (r) => r.coins.map((c) => ({ key: c.mint, cols: [c.mint, c.creator, c.ticker, c.createdAt, JSON.stringify(c)], json: JSON.stringify(c) })),
  },
  {
    table: "coin_images",
    columns: ["mint", "data_url"],
    keys: ["mint"],
    rows: (r) => r.images.map(([mint, url]) => ({ key: mint, cols: [mint, url], json: url })),
  },
  {
    table: "pending_launches",
    columns: ["mint", "data"],
    keys: ["mint"],
    rows: (r) => r.pending.map(([mint, p]) => ({ key: mint, cols: [mint, JSON.stringify(p)], json: JSON.stringify(p) })),
  },
  {
    table: "trades",
    columns: ["id", "mint", "ts", "data"],
    keys: ["id"],
    rows: (r) => r.trades.flatMap(([, list]) => list.map((t) => ({ key: t.id, cols: [t.id, t.mint, t.ts, JSON.stringify(t)], json: JSON.stringify(t) }))),
  },
  {
    table: "used_signatures",
    columns: ["signature"],
    keys: ["signature"],
    rows: (r) => r.signatures.map((s) => ({ key: s, cols: [s], json: "" })),
  },
  {
    table: "comments",
    columns: ["id", "mint", "ts", "data"],
    keys: ["id"],
    rows: (r) => r.comments.flatMap(([, list]) => list.map((c) => ({ key: c.id, cols: [c.id, c.mint, c.ts, JSON.stringify(c)], json: JSON.stringify(c) }))),
  },
  {
    table: "candles",
    columns: ["mint", "time", "data"],
    keys: ["mint", "time"],
    rows: (r) => r.candles.flatMap(([mint, list]) => list.map((k) => ({ key: `${mint}\u0000${k.time}`, cols: [mint, k.time, JSON.stringify(k)], json: JSON.stringify(k) }))),
  },
  {
    table: "referral_links",
    columns: ["code", "owner", "data"],
    keys: ["code"],
    rows: (r) => r.referralLinks.map(([code, l]) => ({ key: code, cols: [code, l.owner, JSON.stringify(l)], json: JSON.stringify(l) })),
  },
  {
    table: "live_events",
    columns: ["id", "ts", "data"],
    keys: ["id"],
    rows: (r) => r.events.map((e) => ({ key: e.id, cols: [e.id, e.ts, JSON.stringify(e)], json: JSON.stringify(e) })),
  },
];

class PostgresBackend {
  private pool: Pool;
  /** What is currently in the database, per table: key -> serialized value. */
  private seen = new Map<string, Map<string, string>>();
  private chain: Promise<void> = Promise.resolve();

  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 4,
      ssl: /sslmode=require|\.proxy\.rlwy\.net/.test(url) ? { rejectUnauthorized: false } : undefined,
    });
    this.pool.on("error", (e) => console.error("[db] pool error", e.message));
  }

  async load(): Promise<RawWorld> {
    await this.pool.query(SCHEMA);
    const raw = emptyRaw();
    const q = async <T extends QueryResultRow>(sql: string): Promise<T[]> => (await this.pool.query<T>(sql)).rows;

    const coins = await q<{ data: Coin }>("SELECT data FROM coins ORDER BY created_at DESC");
    raw.coins = coins.map((r) => r.data);
    raw.images = (await q<{ mint: string; data_url: string }>("SELECT mint, data_url FROM coin_images")).map((r) => [r.mint, r.data_url]);
    raw.pending = (await q<{ mint: string; data: unknown }>("SELECT mint, data FROM pending_launches")).map((r) => [r.mint, r.data]);
    raw.signatures = (await q<{ signature: string }>("SELECT signature FROM used_signatures")).map((r) => r.signature);
    raw.referralLinks = (await q<{ code: string; data: ReferralLink }>("SELECT code, data FROM referral_links")).map((r) => [r.code, r.data]);
    raw.events = (await q<{ data: LiveEvent }>("SELECT data FROM live_events ORDER BY ts DESC LIMIT 300")).map((r) => r.data);

    const group = <T,>(rows: { mint: string; data: T }[]) => {
      const m = new Map<string, T[]>();
      for (const r of rows) {
        let list = m.get(r.mint);
        if (!list) m.set(r.mint, (list = []));
        list.push(r.data);
      }
      return Array.from(m.entries());
    };
    raw.trades = group(await q<{ mint: string; data: Trade }>("SELECT mint, data FROM trades ORDER BY ts DESC"));
    raw.comments = group(await q<{ mint: string; data: Comment }>("SELECT mint, data FROM comments ORDER BY ts DESC"));
    raw.candles = group(await q<{ mint: string; data: Candle }>("SELECT mint, data FROM candles ORDER BY time ASC"));

    const empty = TABLES.every((t) => t.rows(raw).length === 0);
    if (empty) {
      const file = readFile();
      if (file && (file.coins.length > 0 || file.referralLinks.length > 0)) {
        console.log(`[db] importing ${file.coins.length} coin(s) from ${DATA_FILE} into Postgres`);
        await this.flush(file);
        return file;
      }
    }
    this.remember(raw);
    console.log(`[db] postgres ready: ${raw.coins.length} coin(s)`);
    return raw;
  }

  private remember(raw: RawWorld) {
    for (const t of TABLES) {
      const m = new Map<string, string>();
      for (const row of t.rows(raw)) m.set(row.key, row.json);
      this.seen.set(t.table, m);
    }
  }

  async close() {
    await this.chain;
    await this.pool.end();
  }

  /** Saves are serialized so two overlapping flushes never race on the diff. */
  save(raw: RawWorld): Promise<void> {
    this.chain = this.chain.then(() => this.flush(raw)).catch((e) => console.error("[db] save failed", e instanceof Error ? e.message : e));
    return this.chain;
  }

  private async flush(raw: RawWorld) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const t of TABLES) {
        const prev = this.seen.get(t.table) ?? new Map<string, string>();
        const next = new Map<string, string>();
        const upserts: Row[] = [];
        for (const row of t.rows(raw)) {
          next.set(row.key, row.json);
          if (prev.get(row.key) !== row.json || !prev.has(row.key)) upserts.push(row);
        }
        const deletes: string[] = [];
        for (const key of prev.keys()) if (!next.has(key)) deletes.push(key);

        const BATCH = 200;
        for (let i = 0; i < upserts.length; i += BATCH) {
          const slice = upserts.slice(i, i + BATCH);
          const params: unknown[] = [];
          const tuples = slice.map((row) => {
            const ph = row.cols.map((v) => {
              params.push(v);
              return `$${params.length}`;
            });
            return `(${ph.join(",")})`;
          });
          const nonKey = t.columns.filter((c) => !t.keys.includes(c));
          const conflict = nonKey.length
            ? `DO UPDATE SET ${nonKey.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}${t.table === "coins" ? ", updated_at = now()" : ""}`
            : "DO NOTHING";
          await client.query(`INSERT INTO ${t.table} (${t.columns.join(",")}) VALUES ${tuples.join(",")} ON CONFLICT (${t.keys.join(",")}) ${conflict}`, params);
        }
        for (let i = 0; i < deletes.length; i += BATCH) {
          const slice = deletes.slice(i, i + BATCH);
          if (t.keys.length === 1) {
            await client.query(`DELETE FROM ${t.table} WHERE ${t.keys[0]} = ANY($1::text[])`, [slice]);
          } else {
            // composite key (candles): mint + time
            const params: unknown[] = [];
            const tuples = slice.map((k) => {
              const [mint, time] = k.split("\u0000");
              params.push(mint, Number(time));
              return `($${params.length - 1}, $${params.length})`;
            });
            await client.query(`DELETE FROM ${t.table} WHERE (mint, time) IN (${tuples.join(",")})`, params);
          }
        }
        this.seen.set(t.table, next);
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      // Forget what we think is stored so the next save re-sends everything that differs.
      this.seen.clear();
      throw e;
    } finally {
      client.release();
    }
  }
}

/* ----------------------------- public API ----------------------------- */

const g = globalThis as unknown as { __alexpadPg?: PostgresBackend };
const pg = DATABASE_URL ? (g.__alexpadPg ??= new PostgresBackend(DATABASE_URL)) : null;

/** Loads everything the store needs. Never throws: a broken database starts the store empty and logs loudly. */
export async function load(): Promise<RawWorld> {
  if (pg) {
    try {
      return await pg.load();
    } catch (e) {
      console.error("[db] postgres load failed, starting empty", e instanceof Error ? e.message : e);
      return emptyRaw();
    }
  }
  return readFile() ?? emptyRaw();
}

/** Waits for pending saves and closes the connection pool (shutdown and tests). */
export async function close(): Promise<void> {
  if (pg) await pg.close();
}

export async function save(raw: RawWorld): Promise<void> {
  if (pg) return pg.save(raw);
  try {
    writeFile(raw);
  } catch (e) {
    console.error("[db] file save failed", e);
  }
}
