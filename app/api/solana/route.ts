import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Same-origin Solana JSON-RPC relay for the browser. Wallet flows used to call
 * a public RPC straight from the page, which some networks and browsers block
 * ("Failed to fetch"), so launches failed at the approve step. The page now
 * talks to this route and the server forwards to SOLANA_RPC (a keyed RPC whose
 * key never reaches the browser). Only the methods the site actually uses are
 * forwarded, so the key cannot be spent on anything else.
 */
const UPSTREAM = process.env.SOLANA_RPC ?? "https://solana-rpc.publicnode.com";
const ALLOWED = new Set([
  "sendTransaction",
  "simulateTransaction",
  "getSignatureStatuses",
  "getLatestBlockhash",
  "isBlockhashValid",
  "getBlockHeight",
  "getSlot",
  "getEpochInfo",
  "getBalance",
  "getAccountInfo",
  "getMultipleAccounts",
  "getMinimumBalanceForRentExemption",
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getTokenLargestAccounts",
  "getTransaction",
  "getFeeForMessage",
  "getRecentPrioritizationFees",
  "getGenesisHash",
  "getVersion",
]);

type RpcCall = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

export async function POST(req: Request) {
  let body: RpcCall | RpcCall[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > 20) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid batch" } }, { status: 400 });
  const bad = calls.find((c) => !c.method || !ALLOWED.has(c.method));
  if (bad) return NextResponse.json({ jsonrpc: "2.0", id: bad.id ?? null, error: { code: -32601, message: `Method not allowed: ${bad.method}` } }, { status: 403 });
  try {
    const res = await fetch(UPSTREAM, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ jsonrpc: "2.0", id: calls[0]?.id ?? null, error: { code: -32603, message: `Upstream RPC unreachable: ${e instanceof Error ? e.message : "error"}` } }, { status: 502 });
  }
}
