"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useIdentity } from "@/lib/wallet";
import { getRefCookie, useRefCode } from "@/lib/referral";
import { useAsync, useWorldEvents } from "@/lib/hooks";
import { fmtPrice, fmtSol, fmtTokens } from "@/lib/format";
import type { Coin, TradeSide } from "@/types";

const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), { ssr: false });

const BUY_PRESETS = [0.1, 0.5, 1, 5];
const SELL_PRESETS = [25, 50, 75, 100];
const SLIPPAGE = [1, 3, 5, 10];

export function TradePanel({ coin }: { coin: Coin }) {
  const id = useIdentity();
  const [side, setSide] = useState<TradeSide>("buy");
  const [amount, setAmount] = useState("0.5");
  const [slippage, setSlippage] = useState(5);
  const [busy, setBusy] = useState(false);
  const ref = useRefCode();

  const { data: positionData, reload: reloadPosition } = useAsync(
    () => (id.address ? api.getPosition(id.address, coin.mint) : Promise.resolve(0)),
    [id.address, coin.mint],
  );
  const position = positionData ?? 0;
  useWorldEvents((e) => {
    if (e.type === "trade" && e.trade.mint === coin.mint && id.address && e.trade.wallet === id.address) reloadPosition();
  });

  const num = parseFloat(amount) || 0;
  const quote = api.getQuote(coin, side, num, slippage);

  const submit = async () => {
    if (!id.address) return;
    if (!(num > 0)) return toast.error("Enter an amount");
    setBusy(true);
    const t = toast.loading(side === "buy" ? `Buying $${coin.ticker}…` : `Selling $${coin.ticker}…`, { description: "Simulating signature + confirmation" });
    try {
      const res = await api.executeTrade({ mint: coin.mint, side, amount: num, slippagePct: slippage, wallet: id.address, ref: side === "buy" ? getRefCookie() : null });
      toast.success(
        side === "buy"
          ? `Bought ${fmtTokens(res.trade.tokens)} $${coin.ticker} for ${fmtSol(res.trade.sol, 3)} SOL`
          : `Sold ${fmtTokens(res.trade.tokens)} $${coin.ticker} for ${fmtSol(res.trade.sol, 3)} SOL`,
        { id: t, description: res.trade.source && res.trade.source.kind !== "direct" ? `Attributed to ${res.trade.source.label}` : undefined },
      );
      if (res.graduated) toast(`🎓 $${coin.ticker} GRADUATED!`, { description: "Curve complete. Liquidity moves to the DEX pool.", duration: 8000 });
      if (side === "sell") setAmount("0");
      reloadPosition();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trade failed", { id: t });
    } finally {
      setBusy(false);
    }
  };

  if (coin.graduated) {
    return (
      <div className="card p-5 text-center space-y-2">
        <div className="text-3xl">🎓</div>
        <div className="font-display text-2xl text-ice">GRADUATED</div>
        <p className="text-sm text-muted">The bonding curve is complete. Liquidity has moved to a DEX pool; trade it there.</p>
        <a href="#" className="inline-flex h-10 px-4 items-center rounded-lg border border-ice/50 text-ice font-display text-lg tracking-wider">
          OPEN POOL →
        </a>
      </div>
    );
  }

  const buyBtn = side === "buy";
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-black/60 border border-line">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setAmount(s === "buy" ? "0.5" : position > 0 ? String(Math.floor(position)) : "0");
            }}
            className={`h-10 rounded-md font-display text-xl tracking-widest transition ${
              side === s ? (s === "buy" ? "bg-green text-black box-glow-green" : "bg-red text-white") : "text-muted hover:text-white"
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="stat-label">{buyBtn ? "Amount (SOL)" : `Amount ($${coin.ticker})`}</span>
          {!buyBtn && <span className="text-[11px] text-muted">bal: {fmtTokens(position)}</span>}
        </div>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-12 pl-3 pr-16 rounded-lg bg-black/60 border border-line font-display text-2xl tabular focus:outline-none focus:border-gold"
          />
          <span className="absolute right-3 top-0 h-12 flex items-center text-xs text-muted font-bold">{buyBtn ? "SOL" : coin.ticker}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {(buyBtn ? BUY_PRESETS : SELL_PRESETS).map((p) => (
            <button
              key={p}
              onClick={() => setAmount(buyBtn ? String(p) : String(Math.floor((position * p) / 100)))}
              className="h-8 rounded-md border border-line text-xs font-bold text-muted hover:text-white hover:border-gold/50"
            >
              {buyBtn ? `${p} SOL` : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="stat-label">Slippage</span>
          <span className="text-[11px] text-muted">{slippage}%</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SLIPPAGE.map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`h-7 rounded-md border text-xs font-bold ${slippage === s ? "border-gold text-gold bg-gold/10" : "border-line text-muted hover:text-white"}`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-black/40 border border-line p-3 text-xs space-y-1.5">
        <Row label={buyBtn ? "You receive" : "You receive"}>
          {quote ? (buyBtn ? `${fmtTokens(quote.outputTokens)} $${coin.ticker}` : `${fmtSol(quote.outputSol, 4)} SOL`) : "—"}
        </Row>
        <Row label="Min. after slippage">{quote ? (buyBtn ? `${fmtTokens(quote.minReceived)} $${coin.ticker}` : `${fmtSol(quote.minReceived, 4)} SOL`) : "—"}</Row>
        <Row label="Avg price">{quote ? `${fmtPrice(quote.pricePerTokenSol)} SOL` : "—"}</Row>
        <Row label="Price impact">
          {quote ? (
            <span className={Math.abs(quote.priceImpactPct) > 10 ? "text-red" : Math.abs(quote.priceImpactPct) > 3 ? "text-gold" : "text-green"}>
              {quote.priceImpactPct >= 0 ? "+" : ""}
              {quote.priceImpactPct.toFixed(2)}%
            </span>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Protocol fee (1%)">{quote ? `${fmtSol(quote.feeSol, 4)} SOL` : "—"}</Row>
        {buyBtn && (
          <Row label="Attributed to">
            {ref ? <span className="text-green">ref:{ref}</span> : <span className="text-muted">direct</span>}
          </Row>
        )}
      </div>

      {id.address ? (
        <button
          onClick={submit}
          disabled={busy || !quote}
          className={`w-full h-12 rounded-lg font-display text-2xl tracking-widest transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
            buyBtn ? "bg-green text-black box-glow-green hover:brightness-110" : "bg-red text-white hover:brightness-110"
          }`}
        >
          {busy ? "CONFIRMING…" : buyBtn ? `BUY $${coin.ticker}` : `SELL $${coin.ticker}`}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-center [&>button]:w-full [&>button]:justify-center">
            <WalletMultiButton />
          </div>
          <button onClick={() => id.enableDemo()} className="w-full h-10 rounded-lg border border-green/50 text-green font-display text-lg tracking-wider hover:bg-green/10">
            USE A DEMO WALLET
          </button>
          <p className="text-[11px] text-muted text-center">Trades are simulated off-chain for now. A demo wallet lets you use the curve without an extension.</p>
        </div>
      )}
      {id.isDemo && <p className="text-[11px] text-muted text-center">Trading as demo wallet · nothing on-chain</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular text-right">{children}</span>
    </div>
  );
}
