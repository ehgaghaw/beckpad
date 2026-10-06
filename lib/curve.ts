/**
 * pump.fun bonding-curve maths (constant product over virtual reserves).
 * Quotes run on a CurveSnapshot read from chain, so they track the real curve.
 */
import type { CurveSnapshot } from "@/types";

export const TOTAL_SUPPLY = 1_000_000_000;
export const VIRTUAL_SOL = 30;
export const VIRTUAL_TOKENS = 1_073_000_000;
export const INITIAL_REAL_TOKENS = 793_100_000;
export const GRADUATION_SOL = 85;
/** pump.fun protocol fee (1%) + PumpPortal routing fee (0.5%) */
export const FEE_BPS = 150;

export function initialSnapshot(): CurveSnapshot {
  return {
    vSol: VIRTUAL_SOL,
    vTokens: VIRTUAL_TOKENS,
    realSol: 0,
    realTokens: INITIAL_REAL_TOKENS,
    totalSupply: TOTAL_SUPPLY,
    complete: false,
    updatedAt: 0,
  };
}

export function priceOf(s: CurveSnapshot) {
  return s.vTokens > 0 ? s.vSol / s.vTokens : 0;
}

export function marketCapOf(s: CurveSnapshot) {
  return priceOf(s) * (s.totalSupply || TOTAL_SUPPLY);
}

export function progressOf(s: CurveSnapshot) {
  if (s.complete) return 100;
  const byTokens = (1 - s.realTokens / INITIAL_REAL_TOKENS) * 100;
  return Math.max(0, Math.min(100, byTokens));
}

export interface BuyQuote {
  solIn: number;
  solNet: number;
  feeSol: number;
  tokensOut: number;
  priceBefore: number;
  priceAfter: number;
  priceImpactPct: number;
  graduates: boolean;
  next: CurveSnapshot;
}

export function quoteBuy(s: CurveSnapshot, solIn: number): BuyQuote {
  const feeSol = solIn * (FEE_BPS / 10_000);
  const solNet = Math.max(0, solIn - feeSol);
  const k = s.vSol * s.vTokens;
  const newVSol = s.vSol + solNet;
  let tokensOut = s.vTokens - k / newVSol;
  let graduates = false;
  if (tokensOut >= s.realTokens) {
    tokensOut = s.realTokens;
    graduates = true;
  }
  const newVTokens = s.vTokens - tokensOut;
  const priceBefore = priceOf(s);
  const priceAfter = newVSol / newVTokens;
  return {
    solIn,
    solNet,
    feeSol,
    tokensOut,
    priceBefore,
    priceAfter,
    priceImpactPct: priceBefore > 0 ? ((priceAfter - priceBefore) / priceBefore) * 100 : 0,
    graduates,
    next: { ...s, vSol: newVSol, vTokens: newVTokens, realSol: s.realSol + solNet, realTokens: s.realTokens - tokensOut, complete: graduates, updatedAt: Date.now() },
  };
}

export interface SellQuote {
  tokensIn: number;
  solGross: number;
  solOut: number;
  feeSol: number;
  priceBefore: number;
  priceAfter: number;
  priceImpactPct: number;
}

export function quoteSell(s: CurveSnapshot, tokensIn: number): SellQuote {
  const t = Math.max(0, tokensIn);
  const solGross = (t * s.vSol) / (s.vTokens + t);
  const feeSol = solGross * (FEE_BPS / 10_000);
  const priceBefore = priceOf(s);
  const priceAfter = (s.vSol - solGross) / (s.vTokens + t);
  return {
    tokensIn: t,
    solGross,
    solOut: solGross - feeSol,
    feeSol,
    priceBefore,
    priceAfter,
    priceImpactPct: priceBefore > 0 ? ((priceAfter - priceBefore) / priceBefore) * 100 : 0,
  };
}
