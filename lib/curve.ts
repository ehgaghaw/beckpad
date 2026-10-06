/**
 * pump.fun-style constant-product bonding curve with virtual reserves.
 * Mirrors what the Phase 2 Anchor program will implement on-chain.
 */
export const TOTAL_SUPPLY = 1_000_000_000; // 1B tokens
export const VIRTUAL_SOL = 30; // initial virtual SOL reserve
export const VIRTUAL_TOKENS = 1_073_000_000; // initial virtual token reserve
export const GRADUATION_SOL = 85; // real SOL collected to graduate
export const FEE_BPS = 100; // 1% protocol fee
export const K = VIRTUAL_SOL * VIRTUAL_TOKENS;

export interface CurveState {
  realSol: number;
  virtualSol: number;
  virtualTokens: number;
  tokensSold: number;
  priceSol: number;
  marketCapSol: number;
  pct: number;
}

export function curveState(realSol: number): CurveState {
  const r = Math.max(0, Math.min(GRADUATION_SOL, realSol));
  const virtualSol = VIRTUAL_SOL + r;
  const virtualTokens = K / virtualSol;
  const tokensSold = VIRTUAL_TOKENS - virtualTokens;
  const priceSol = virtualSol / virtualTokens;
  return {
    realSol: r,
    virtualSol,
    virtualTokens,
    tokensSold,
    priceSol,
    marketCapSol: priceSol * TOTAL_SUPPLY,
    pct: (r / GRADUATION_SOL) * 100,
  };
}

export function applyFee(sol: number) {
  return sol * (1 - FEE_BPS / 10_000);
}

export interface BuyQuote {
  solIn: number;
  solNet: number;
  feeSol: number;
  tokensOut: number;
  newRealSol: number;
  priceBefore: number;
  priceAfter: number;
  priceImpactPct: number;
  graduates: boolean;
}

export function quoteBuy(realSol: number, solIn: number): BuyQuote {
  const s = curveState(realSol);
  const remaining = GRADUATION_SOL - s.realSol;
  const feeSol = solIn * (FEE_BPS / 10_000);
  let solNet = solIn - feeSol;
  let graduates = false;
  if (solNet >= remaining) {
    solNet = remaining;
    graduates = true;
  }
  const newVirtualSol = s.virtualSol + solNet;
  const newVirtualTokens = K / newVirtualSol;
  const tokensOut = s.virtualTokens - newVirtualTokens;
  const priceAfter = newVirtualSol / newVirtualTokens;
  return {
    solIn,
    solNet,
    feeSol,
    tokensOut,
    newRealSol: s.realSol + solNet,
    priceBefore: s.priceSol,
    priceAfter,
    priceImpactPct: ((priceAfter - s.priceSol) / s.priceSol) * 100,
    graduates,
  };
}

export interface SellQuote {
  tokensIn: number;
  solOut: number;
  feeSol: number;
  newRealSol: number;
  priceBefore: number;
  priceAfter: number;
  priceImpactPct: number;
}

export function quoteSell(realSol: number, tokensIn: number): SellQuote {
  const s = curveState(realSol);
  const t = Math.max(0, Math.min(tokensIn, s.tokensSold));
  const newVirtualTokens = s.virtualTokens + t;
  const newVirtualSol = K / newVirtualTokens;
  const solGross = s.virtualSol - newVirtualSol;
  const feeSol = solGross * (FEE_BPS / 10_000);
  const priceAfter = newVirtualSol / newVirtualTokens;
  return {
    tokensIn: t,
    solOut: solGross - feeSol,
    feeSol,
    newRealSol: Math.max(0, s.realSol - solGross),
    priceBefore: s.priceSol,
    priceAfter,
    priceImpactPct: ((priceAfter - s.priceSol) / s.priceSol) * 100,
  };
}

/** Rough tokens-for-SOL at spot price, used for display only. */
export function tokensAtSpot(realSol: number, sol: number) {
  return sol / curveState(realSol).priceSol;
}
