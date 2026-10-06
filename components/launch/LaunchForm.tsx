"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Keypair } from "@solana/web3.js";
import { api } from "@/lib/api";
import { useIdentity } from "@/lib/wallet";
import { usePumpTx, EXPLORER, SentButUnconfirmed } from "@/lib/solana";
import { useEffect } from "react";

const PENDING_KEY = "alexpad_pending_launch";
interface PendingLaunch {
  mint: string;
  signature: string;
  creator: string;
  ticker: string;
}
function readPending(): PendingLaunch | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingLaunch) : null;
  } catch {
    return null;
  }
}
function writePending(p: PendingLaunch | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
import { Modal } from "@/components/ui/Modal";
import { CoinAvatar } from "@/components/ui/CoinAvatar";
import { LaunchPreview } from "./LaunchPreview";
import type { LaunchInput } from "@/types";

const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), { ssr: false });

const EMOJIS = ["🪙", "🧠", "🖨️", "🚀", "🐸", "🐶", "🐋", "💎", "🔥", "🎯", "👑", "🗿", "🧬", "🎮", "🌕", "🦍"];

export function LaunchForm() {
  const id = useIdentity();
  const router = useRouter();
  const sendTx = usePumpTx();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [form, setForm] = useState<LaunchInput>({
    name: "",
    ticker: "",
    description: "",
    emoji: "🪙",
    imageUrl: undefined,
    socials: {},
    devBuySol: 0.1,
    devLock: false,
    creator: "",
  });
  const input: LaunchInput = { ...form, creator: id.address ?? "" };
  const set = <K extends keyof LaunchInput>(k: K, v: LaunchInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** Register a coin whose create transaction was sent; retries while the chain catches up. */
  const register = async (mint: string, signature: string, creator: string) => {
    let lastErr: unknown = null;
    for (let i = 0; i < 8; i++) {
      try {
        return await api.registerCoin({ mint, signature, creator });
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Could not list the coin yet");
  };

  // A previous launch was sent but never listed (e.g. the page closed mid-confirmation): finish it.
  useEffect(() => {
    const p = readPending();
    if (!p || !id.address || p.creator !== id.address) return;
    const t = toast.loading(`Finishing your $${p.ticker} launch…`, { description: "Verifying the create transaction on Solana" });
    register(p.mint, p.signature, p.creator)
      .then((coin) => {
        writePending(null);
        toast.success(`$${coin.ticker} is listed`, { id: t });
        router.push(`/coin/${coin.mint}`);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not finish the launch", { id: t, duration: 10000 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id.address]);

  const errors: string[] = [];
  if (form.name.trim().length < 2) errors.push("Name needs at least 2 characters");
  if (!/^[A-Za-z0-9]{2,10}$/.test(form.ticker)) errors.push("Ticker: 2–10 letters/numbers");
  if (form.description.trim().length < 10) errors.push("Description needs at least 10 characters");
  if (!form.imageUrl) errors.push("Upload an image (pump.fun shows it everywhere)");
  if (form.devBuySol < 0.01 || form.devBuySol > 20) errors.push("Dev buy must be 0.01–20 SOL");

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1024 * 1024) return toast.error("Image must be under 1 MB");
    const r = new FileReader();
    r.onload = () => set("imageUrl", String(r.result));
    r.readAsDataURL(f);
  };

  const launch = async () => {
    if (!id.address) return;
    setBusy(true);
    const t = toast.loading(`Launching $${form.ticker.toUpperCase()}…`, { description: "Preparing metadata" });
    const status = (s: string) => {
      setStep(s);
      toast.loading(`Launching $${form.ticker.toUpperCase()}…`, { id: t, description: s });
    };
    try {
      const mintKp = Keypair.generate();
      const mint = mintKp.publicKey.toBase58();
      status("Uploading metadata…");
      const meta = await api.prepareLaunch({
        mint,
        name: form.name,
        ticker: form.ticker,
        description: form.description,
        imageDataUrl: form.imageUrl,
        emoji: form.emoji,
        socials: form.socials,
        creator: id.address,
      });
      let signature: string;
      try {
        signature = await sendTx(
          {
            action: "create",
            mint,
            amount: form.devBuySol,
            denominatedInSol: true,
            slippage: 10,
            priorityFee: 0.0005,
            tokenMetadata: { name: meta.name, symbol: meta.symbol, uri: meta.uri },
          },
          [mintKp],
          status,
        );
      } catch (e) {
        // The wallet sent it but our RPC could not confirm: the server verifies on-chain anyway.
        if (e instanceof SentButUnconfirmed) signature = e.signature;
        else throw e;
      }
      writePending({ mint, signature, creator: id.address, ticker: meta.symbol });
      status("Sent. Listing on AlexPad…");
      const coin = await register(mint, signature, id.address);
      writePending(null);
      toast.success(`$${coin.ticker} is live on Solana!`, {
        id: t,
        description: "Token created on pump.fun. View the transaction on Solscan.",
        action: { label: "Solscan", onClick: () => window.open(EXPLORER(signature), "_blank") },
        duration: 10000,
      });
      setConfirm(false);
      router.push(`/coin/${mint}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Launch failed";
      toast.error(/user rejected|rejected the request/i.test(msg) ? "Cancelled in wallet" : msg, { id: t, duration: 10000 });
      setBusy(false);
      setStep(null);
    }
  };

  const field = "w-full h-11 px-3 rounded-lg bg-black/60 border border-line text-sm focus:outline-none focus:border-gold";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-5">
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="font-display font-bold text-xl tracking-[0.2em] text-gold">1 · IDENTITY</div>
          <div className="flex gap-4 items-start">
            <div className="space-y-2">
              <CoinAvatar emoji={form.emoji} hue={45} imageUrl={form.imageUrl} size={96} className="rounded-2xl" />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} className="w-24 h-8 rounded-md border border-line text-xs font-bold text-muted hover:text-white">
                {form.imageUrl ? "Change" : "Upload"}
              </button>
              {form.imageUrl && (
                <button onClick={() => set("imageUrl", undefined)} className="w-24 h-7 text-[11px] text-red hover:underline">
                  remove
                </button>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="stat-label">Name</label>
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={32} placeholder="Printer Go Brrr" className={field} />
                </div>
                <div>
                  <label className="stat-label">Ticker</label>
                  <input
                    value={form.ticker}
                    onChange={(e) => set("ticker", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                    placeholder="BRRR"
                    className={`${field} font-display font-bold text-lg tracking-widest`}
                  />
                </div>
              </div>
              <div>
                <label className="stat-label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="What's the lore? Why will this print?"
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-line text-sm focus:outline-none focus:border-gold resize-none"
                />
                <div className="text-[10px] text-muted text-right">{form.description.length}/500</div>
              </div>
              {!form.imageUrl && (
                <div>
                  <label className="stat-label">Placeholder emoji (until you upload an image)</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => set("emoji", e)}
                        className={`w-9 h-9 rounded-md border text-lg ${form.emoji === e ? "border-gold bg-gold/10" : "border-line hover:border-white/30"}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-5 space-y-3">
          <div className="font-display font-bold text-xl tracking-[0.2em] text-gold">2 · SOCIALS</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["twitter", "telegram", "website"] as const).map((k) => (
              <div key={k}>
                <label className="stat-label">{k === "twitter" ? "X / Twitter" : k}</label>
                <input
                  value={form.socials[k] ?? ""}
                  onChange={(e) => set("socials", { ...form.socials, [k]: e.target.value || undefined })}
                  placeholder={k === "twitter" ? "https://x.com/…" : k === "telegram" ? "https://t.me/…" : "https://…"}
                  className={field}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 sm:p-5 space-y-4">
          <div className="font-display font-bold text-xl tracking-[0.2em] text-gold">3 · DEV BUY</div>
          <div>
            <div className="flex items-center justify-between">
              <label className="stat-label">Your first buy (same transaction)</label>
              <span className="font-display font-bold text-2xl text-green tabular">{form.devBuySol.toFixed(2)} SOL</span>
            </div>
            <input type="range" min={0.01} max={10} step={0.01} value={form.devBuySol} onChange={(e) => set("devBuySol", parseFloat(e.target.value))} className="w-full" />
            <p className="text-[11px] text-muted">Buys your own first tokens at launch. Big dev buys lower the Rug Check score because the dev wallet holds more supply.</p>
          </div>
          <div className="rounded-lg border border-line bg-black/40 p-3 text-xs text-muted space-y-1">
            <div className="flex justify-between">
              <span>Token creation + network fees</span>
              <span className="text-white">~0.02 SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Trading fee on the dev buy</span>
              <span className="text-white">1.5%</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-white">Approx. total from your wallet</span>
              <span className="text-gold">{(form.devBuySol * 1.015 + 0.02).toFixed(3)} SOL</span>
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <ul className="text-xs text-red space-y-0.5 px-1">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}

        {id.address ? (
          <button
            onClick={() => setConfirm(true)}
            disabled={errors.length > 0}
            className="w-full h-14 rounded-lg bg-green text-black font-display font-bold text-2xl tracking-widest box-glow-green hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition"
          >
            REVIEW & LAUNCH
          </button>
        ) : (
          <div className="card p-4 flex flex-col sm:flex-row items-center gap-3">
            <span className="text-sm text-muted flex-1">Connect a Solana wallet with a little SOL to launch. The token is created on mainnet.</span>
            <WalletMultiButton />
          </div>
        )}
      </div>

      <div className="lg:col-span-2 lg:sticky lg:top-28 self-start">
        <LaunchPreview input={input} />
      </div>

      <Modal open={confirm} onClose={() => !busy && setConfirm(false)} title={`LAUNCH $${form.ticker.toUpperCase()}?`}>
        <div className="space-y-4">
          <LaunchPreview input={input} />
          <ul className="text-xs text-muted space-y-1">
            <li>• Creates a real SPL token on Solana mainnet with a 1B supply on the pump.fun bonding curve.</li>
            <li>• Your dev buy of {form.devBuySol.toFixed(2)} SOL executes in the same transaction.</li>
            <li>• Your wallet will ask you to approve one transaction (~{(form.devBuySol * 1.015 + 0.02).toFixed(3)} SOL total).</li>
            <li>• This cannot be undone. Tokens created on the curve cannot be deleted.</li>
          </ul>
          {step && <div className="text-xs text-gold font-bold">{step}</div>}
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)} disabled={busy} className="flex-1 h-12 rounded-lg border border-line font-display font-bold text-xl tracking-widest text-muted hover:text-white">
              BACK
            </button>
            <button onClick={launch} disabled={busy} className="flex-1 h-12 rounded-lg bg-green text-black font-display font-bold text-xl tracking-widest box-glow-green disabled:opacity-50">
              {busy ? "LAUNCHING…" : "SEND IT 🚀"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
