import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { buildPumpTx } from "@/lib/chain";
import type { CoinTab, PrepareLaunchInput, PumpTxRequest, Range, RecordTradeInput, RegisterCoinInput } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */
const methods: Record<string, (...args: any[]) => unknown> = {
  listCoins: (tab: CoinTab, limit?: number) => store.listCoins(tab, limit),
  getCoin: (mint: string) => store.getCoin(mint),
  getCoinOfTheHour: () => store.coinOfTheHour(),
  getMoneyPrinter: (limit?: number) => store.biggestBuys(limit),
  getRecentEvents: (limit?: number) => store.recentEvents(limit),
  getTrades: (mint: string, limit?: number) => store.getTrades(mint, limit),
  getHolders: (mint: string) => store.getHolders(mint),
  getComments: (mint: string) => store.getComments(mint),
  getCandles: (mint: string) => store.getCandles(mint),
  getPosition: (wallet: string, mint: string) => store.getPosition(wallet, mint),
  getLeaderboard: (range: Range) => store.leaderboard(range),
  getProfile: (wallet: string) => store.profileFor(wallet),
  sync: (since: number) => store.sync(Number(since) || 0),
  prepareLaunch: (input: PrepareLaunchInput) => store.prepareLaunch(input),
  registerCoin: (input: RegisterCoinInput) => store.registerCoin(input),
  recordTrade: (input: RecordTradeInput) => store.recordTrade(input),
  buildTx: (req: PumpTxRequest) => buildPumpTx(req),
  createReferralLink: (wallet: string, label: string, mint?: string) => store.createReferralLink(wallet, label, mint),
  recordRefClick: (code: string) => store.recordClick(code),
  postComment: (mint: string, wallet: string, text: string) => store.postComment(mint, wallet, text),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  let body: { method?: string; params?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const fn = body.method ? methods[body.method] : undefined;
  if (!fn) return NextResponse.json({ ok: false, error: "Unknown method" }, { status: 404 });
  try {
    const result = await fn(...(Array.isArray(body.params) ? body.params : []));
    return NextResponse.json({ ok: true, result: result ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Request failed" }, { status: 400 });
  }
}
