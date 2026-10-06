export type RugGrade = "A" | "B" | "C" | "D" | "F";
export type Tier = "Bronze" | "Silver" | "Gold" | "Diamond" | "Whale Tier";
export type SourceKind = "referral" | "x_post" | "caller" | "direct";
export type CoinTab = "trending" | "new" | "graduating" | "graduated";
export type TradeSide = "buy" | "sell";
export type Range = "24h" | "7d" | "all";

export interface Source {
  id: string;
  kind: SourceKind;
  /** Display label, e.g. "ref:BECK-7F2A" */
  label: string;
  /** Owner wallet (short) for referral sources */
  handle?: string;
  url?: string;
}

export interface Attribution {
  source: Source;
  buys: number;
  uniqueBuyers: number;
  volumeSol: number;
  /** 0..1 share of total buy volume */
  share: number;
}

export interface RugCheck {
  devWalletPct: number;
  top10Pct: number;
  bundledBuys: number;
  bundledDetected: boolean;
  devSold: boolean;
  devLocked: boolean;
  /** 0..100 */
  score: number;
  grade: RugGrade;
  notes: string[];
}

export interface CoinSocials {
  twitter?: string;
  telegram?: string;
  website?: string;
}

/** Live bonding-curve reserves read from the pump.fun program (human units: SOL and whole tokens). */
export interface CurveSnapshot {
  vSol: number;
  vTokens: number;
  realSol: number;
  realTokens: number;
  totalSupply: number;
  complete: boolean;
  updatedAt: number;
}

export interface Coin {
  mint: string;
  name: string;
  ticker: string;
  description: string;
  /** Emoji + hue drive the generated avatar when no imageUrl is set */
  emoji: string;
  hue: number;
  imageUrl?: string;
  /** Token metadata URI registered on-chain */
  metadataUri: string;
  /** Signature of the create transaction */
  signature: string;
  creator: string;
  createdAt: number;
  curve: CurveSnapshot;
  /** Real SOL collected on the bonding curve */
  realSol: number;
  priceSol: number;
  marketCapSol: number;
  marketCapUsd: number;
  /** 0..100 progress along the bonding curve */
  curvePct: number;
  holders: number;
  volume24hSol: number;
  change24h: number;
  replies: number;
  graduated: boolean;
  graduatedAt?: number;
  devLock: boolean;
  devBuySol: number;
  socials: CoinSocials;
  rug: RugCheck;
  attribution: Attribution[];
  topSource: Source | null;
}

export interface Trade {
  id: string;
  signature: string;
  mint: string;
  ticker: string;
  side: TradeSide;
  sol: number;
  tokens: number;
  wallet: string;
  ts: number;
  source: Source | null;
}

export interface Holder {
  wallet: string;
  pct: number;
  tokens: number;
  isDev: boolean;
  isCurve: boolean;
}

export interface Comment {
  id: string;
  mint: string;
  wallet: string;
  text: string;
  ts: number;
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

/** A referral-link owner ranked by the volume their links drove. */
export interface Caller {
  id: string;
  /** Wallet address */
  handle: string;
  name: string;
  hue: number;
  tier: Tier;
  volumeSol: Record<Range, number>;
  buyers: Record<Range, number>;
  coinsCalled: number;
  winRate: number;
  bestCall: { ticker: string; mint: string; multiple: number } | null;
}

export interface ReferralLink {
  code: string;
  owner: string;
  label: string;
  mint?: string;
  ticker?: string;
  url: string;
  clicks: number;
  buys: number;
  uniqueBuyers: number;
  volumeSol: number;
  createdAt: number;
}

export interface Profile {
  wallet: string;
  tier: Tier;
  degenScore: number;
  trackedVolumeSol: number;
  launches: Coin[];
  referralLinks: ReferralLink[];
  tradesCount: number;
  pnlSol: number;
  joinedAt: number;
}

export interface LiveEvent {
  id: string;
  kind: "buy" | "sell" | "launch" | "graduate";
  mint: string;
  ticker: string;
  emoji: string;
  hue: number;
  sol?: number;
  wallet?: string;
  ts: number;
}

export interface Quote {
  side: TradeSide;
  inputAmount: number;
  outputTokens: number;
  outputSol: number;
  priceImpactPct: number;
  pricePerTokenSol: number;
  minReceived: number;
  feeSol: number;
  graduates: boolean;
}

/** Form state for the launch page. */
export interface LaunchInput {
  name: string;
  ticker: string;
  description: string;
  imageUrl?: string;
  emoji: string;
  socials: CoinSocials;
  devBuySol: number;
  devLock: boolean;
  creator: string;
}

/** Step 1 of a launch: park metadata so the token URI resolves before the mint exists. */
export interface PrepareLaunchInput {
  mint: string;
  name: string;
  ticker: string;
  description: string;
  imageDataUrl?: string;
  emoji: string;
  socials: CoinSocials;
  creator: string;
}

/** Step 3 of a launch: the create transaction confirmed on-chain. */
export interface RegisterCoinInput {
  mint: string;
  signature: string;
  creator: string;
}

export interface RecordTradeInput {
  signature: string;
  mint: string;
  wallet: string;
  side: TradeSide;
  ref?: string | null;
}

/** Request for a PumpPortal local transaction (built server-side, signed in the browser). */
export interface PumpTxRequest {
  action: "create" | "buy" | "sell" | "collectCreatorFee";
  publicKey: string;
  mint?: string;
  amount?: number | string;
  denominatedInSol?: boolean;
  slippage?: number;
  priorityFee?: number;
  tokenMetadata?: { name: string; symbol: string; uri: string };
}

export interface CreatorFees {
  /** SOL claimable from the pump.fun creator vault (bonding-curve trades) */
  claimableSol: number;
  vault: string;
}

/** Payload returned by the sync endpoint for live updates. */
export interface SyncResult {
  now: number;
  events: LiveEvent[];
  trades: Trade[];
  coins: Coin[];
}
