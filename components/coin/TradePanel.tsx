"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useIdentity } from "@/lib/wallet";
import { usePumpTx, EXPLORER } from "@/lib/solana";
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
  const sendTx = usePumpTx();
  const [side, setSide] = useState<TradeSide>("buy");
  const [amount, setAmount] = useState("0.1");
  const [slippage, setSlippage] = useState(5);
  const [busy, setBusy] = useState(false);
  const [sellPct, setSellPct] = useState<number | null>(null);
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
  const buyBtn = side === "buy";

  const submit = async () => {
    if (!id.address) return;
    if (!(num > 0)) return toast.error("Enter an amount");
    if (!buyBtn && num > position * 1.0001) return toast.error("Not enough tokens in this wallet");
    setBusy(true);
    const t = toast.loading(buyBtn ? `Buying $${coin.ticker}…` : `Selling $${coin.ticker}…`, { description: "Building transaction…" });
    try {
      const signature = await sendTx(
        {
          action: side,
          mint: coin.mint,
          amount: buyBtn ? num : sellPct === 100 ? "100%" : Math.floor(num),
          denominatedInSol: buyBtn,
          slippage,
        },
        [],
        (s) => toast.loading(buyBtn ? `Buying $${coin.ticker}…` : `Selling $${coin.ticker}…`, { id: t, description: s }),
      );
      toast.loading("Confirmed. Recording attribution…", { id: t, description: signature.slice(0, 20) + "…" });
      const res = await api.recordTrade({ signature, mint: coin.mint, wallet: id.address, side, ref: buyBtn ? getRefCookie() : null });
      toast.success(
        res.trade.side === "buy"
          ? `Bought ${fmtTokens(res.trade.tokens)} $${coin.ticker} for ${fmtSol(res.trade.sol, 4)} SOL`
          : `Sold ${fmtTokens(res.trade.tokens)} $${coin.ticker} for ${fmtSol(res.trade.sol, 4)} SOL`,
        {
          id: t,
          description: res.trade.source && res.trade.source.kind !== "direct" ? `Attributed to ${res.trade.source.label}` : "View on Solscan",
          action: { label: "Solscan", onClick: () => window.open(EXPLORER(signature), "_blank") },
          duration: 8000,
        },
      );
      if (res.graduated) toast(`🎓 $${coin.ticker} GRADUATED!`, { description: "Curve complete. Liquidity moves to the DEX pool.", duration: 8000 });
      if (!buyBtn) setAmount("0");
      setSellPct(null);
      reloadPosition();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Trade failed";
      toast.error(/user rejected|rejected the request/i.test(msg) ? "Cancelled in wallet" : msg, { id: t, duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  if (coin.graduated) {
    return (
      <div className="card p-5 text-center space-y-2">
        <div className="text-3xl">🎓</div>
        <div className="font-display font-bold text-2xl text-ice">GRADUATED</div>
        <p className="text-sm text-muted">The bonding curve is complete and liquidity moved to the DEX pool.</p>
        <a
          href={`https://pump.fun/coin/${coin.mint}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 px-4 items-center rounded-lg border-2 border-ice/60 text-ice font-display font-bold text-lg tracking-wider"
        >
          TRADE ON PUMPSWAP →
        </a>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-black/60 border border-line">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setSellPct(null);
              setAmount(s === "buy" ? "0.1" : position > 0 ? String(Math.floor(position)) : "0");
            }}
            className={`h-10 rounded-md font-display font-bold text-xl tracking-widest transition ${
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
            onChange={(e) => {
              setAmount(e.target.value);
              setSellPct(null);
            }}
            className="w-full h-12 pl-3 pr-16 rounded-lg bg-black/60 border border-line font-display font-bold text-2xl tabular focus:outline-none focus:border-gold"
          />
          <span className="absolute right-3 top-0 h-12 flex items-center text-xs text-muted font-bold">{buyBtn ? "SOL" : coin.ticker}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {(buyBtn ? BUY_PRESETS : SELL_PRESETS).map((p) => (
            <button
              key={p}
              onClick={() => {
                if (buyBtn) setAmount(String(p));
                else {
                  setAmount(String(Math.floor((position * p) / 100)));
                  setSellPct(p);
                }
              }}
              className={`h-8 rounded-md border text-xs font-bold ${!buyBtn && sellPct === p ? "border-gold text-gold" : "border-line text-muted hover:text-white hover:border-gold/50"}`}
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
        <Row label="You receive (est.)">{quote ? (buyBtn ? `${fmtTokens(quote.outputTokens)} $${coin.ticker}` : `${fmtSol(quote.outputSol, 4)} SOL`) : "—"}</Row>
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
        <Row label="Fees (pump.fun 1% + router 0.5%)">{quote ? `${fmtSol(quote.feeSol, 4)} SOL` : "—"}</Row>
        {buyBtn && (
          <Row label="Attributed to">{ref ? <span className="text-green">ref:{ref}</span> : <span className="text-muted">direct</span>}</Row>
        )}
        {quote?.graduates && <div className="text-gold font-bold">This buy completes the curve 🎓</div>}
      </div>

      {id.address ? (
        <button
          onClick={submit}
          disabled={busy || !quote}
          className={`w-full h-12 rounded-lg font-display font-bold text-2xl tracking-widest transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
            buyBtn ? "bg-green text-black box-glow-green hover:brightness-110" : "bg-red text-white hover:brightness-110"
          }`}
        >
          {busy ? "WORKING…" : buyBtn ? `BUY $${coin.ticker}` : `SELL $${coin.ticker}`}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-center [&>button]:w-full [&>button]:justify-center">
            <WalletMultiButton />
          </div>
          <p className="text-[11px] text-muted text-center">Connect a Solana wallet to trade. Every trade is a real mainnet transaction you approve.</p>
        </div>
      )}
      <p className="text-[10px] text-muted text-center">
        Trades execute on the pump.fun bonding curve.{" "}
        <a href={`https://pump.fun/coin/${coin.mint}`} target="_blank" rel="noreferrer" className="underline hover:text-white">
          View on pump.fun
        </a>
      </p>
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
