"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Keypair } from "@solana/web3.js";
import { api } from "@/lib/api";
import { useIdentity } from "@/lib/wallet";
import { usePumpTx, EXPLORER, SentButUnconfirmed } from "@/lib/solana";
import { Modal } from "@/components/ui/Modal";
import { LaunchPreview } from "./LaunchPreview";
import type { LaunchInput } from "@/types";

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

const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), { ssr: false });

const field = "w-full h-11 px-3 bg-black/50 border border-line font-mono text-sm focus:outline-none focus:border-gold transition placeholder:text-muted/60";
const label = "block font-mono text-[9px] uppercase tracking-[0.24em] text-muted mb-1.5";

/** A numbered step with a vertical rule, like entries in a procedure. */
function Step({ n, title, hint, children }: { n: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[40px_1fr] sm:grid-cols-[64px_1fr] gap-4 sm:gap-6">
      <div className="relative">
        <span className="font-mono text-[11px] text-gold tracking-[0.2em]">{n}</span>
        <span className="absolute left-[3px] top-7 bottom-0 w-px bg-line" aria-hidden />
      </div>
      <div className="pb-10">
        <h2 className="font-display text-3xl sm:text-4xl leading-none">{title}</h2>
        <p className="font-mono text-[11px] text-muted mt-1.5 mb-5">{hint}</p>
        {children}
      </div>
    </section>
  );
}

export function LaunchForm() {
  const id = useIdentity();
  const router = useRouter();
  const sendTx = usePumpTx();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
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
        toast.success(`$${coin.ticker} is filed`, { id: t });
        router.push(`/coin/${coin.mint}`);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not finish the launch", { id: t, duration: 10000 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id.address]);

  const errors: string[] = [];
  if (form.name.trim().length < 2) errors.push("name: at least 2 characters");
  if (!/^[A-Za-z0-9]{2,10}$/.test(form.ticker)) errors.push("ticker: 2–10 letters or numbers");
  if (form.description.trim().length < 10) errors.push("description: at least 10 characters");
  if (!form.imageUrl) errors.push("image: required (pump.fun shows it everywhere)");
  if (form.devBuySol < 0.01 || form.devBuySol > 20) errors.push("first buy: 0.01–20 SOL");

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("That is not an image");
    if (f.size > 1024 * 1024) return toast.error("Image must be under 1 MB");
    const r = new FileReader();
    r.onload = () => set("imageUrl", String(r.result));
    r.readAsDataURL(f);
  };

  const total = (form.devBuySol * 1.015 + 0.02).toFixed(3);

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
      status("Sent. Filing on ZerePad…");
      const coin = await register(mint, signature, id.address);
      writePending(null);
      toast.success(`$${coin.ticker} is live on Solana`, {
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

  const blocks = 20;
  const lit = Math.round((Math.min(form.devBuySol, 10) / 10) * blocks);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 lg:gap-14">
      <div>
        <Step n="01" title="Give it a face" hint="Square image, under 1 MB. This is what pump.fun, wallets and terminals show.">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              onFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileRef.current?.click()}
            className={`dropzone relative w-full max-w-[280px] aspect-square cursor-pointer flex items-center justify-center overflow-hidden ${drag ? "is-drag" : ""} ${form.imageUrl ? "has-img" : ""}`}
          >
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="" className="w-full h-full object-cover pixelated" />
            ) : (
              <div className="text-center px-6">
                <div className="font-display text-3xl">Drop image</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted mt-2">or click to choose</div>
              </div>
            )}
            <span className="scanline" aria-hidden />
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {form.imageUrl && (
            <button
              onClick={() => set("imageUrl", undefined)}
              className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted hover:text-red transition"
            >
              × remove image
            </button>
          )}
        </Step>

        <Step n="02" title="Give it a name" hint="The ticker is permanent. Choose like you mean it.">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
            <div>
              <label className={label}>Name</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={32} placeholder="e.g. Subject Zero" className={field} />
            </div>
            <div>
              <label className={label}>Ticker</label>
              <input
                value={form.ticker}
                onChange={(e) => set("ticker", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                placeholder="ZERO"
                className={`${field} text-gold tracking-[0.2em]`}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className={label}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What is it. Why does it exist. Keep some of it secret."
              className={`${field} h-auto py-2.5 resize-none leading-relaxed`}
            />
            <div className="font-mono text-[9px] text-muted text-right mt-1 tabular">{form.description.length} / 500</div>
          </div>
        </Step>

        <Step n="03" title="Leave a trail" hint="Optional. Links show on the coin page and on pump.fun.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["twitter", "telegram", "website"] as const).map((k) => (
              <div key={k}>
                <label className={label}>{k === "twitter" ? "X" : k}</label>
                <input
                  value={form.socials[k] ?? ""}
                  onChange={(e) => set("socials", { ...form.socials, [k]: e.target.value || undefined })}
                  placeholder={k === "twitter" ? "x.com/…" : k === "telegram" ? "t.me/…" : "https://…"}
                  className={field}
                />
              </div>
            ))}
          </div>
        </Step>

        <Step n="04" title="First buy" hint="Your own first tokens, bought in the same transaction that creates the coin.">
          <div className="flex items-end justify-between gap-4">
            <div className="flex gap-[3px] flex-1 max-w-sm">
              {Array.from({ length: blocks }).map((_, i) => (
                <span key={i} className={`flex-1 h-5 transition ${i < lit ? "bg-gold" : "bg-white/10"}`} />
              ))}
            </div>
            <span className="font-display text-4xl leading-none text-gold tabular">
              {form.devBuySol.toFixed(2)} <span className="font-mono text-xs text-muted tracking-[0.2em]">SOL</span>
            </span>
          </div>
          <input type="range" min={0.01} max={10} step={0.01} value={form.devBuySol} onChange={(e) => set("devBuySol", parseFloat(e.target.value))} className="w-full max-w-sm mt-3 block" />
          <p className="font-mono text-[10px] text-muted mt-2 max-w-sm">A large first buy means the dev wallet holds more supply, which lowers the rug check grade.</p>
          <dl className="receipt mt-6 max-w-sm">
            <div>
              <dt>token creation + network</dt>
              <dd>~0.020 SOL</dd>
            </div>
            <div>
              <dt>first buy</dt>
              <dd>{form.devBuySol.toFixed(3)} SOL</dd>
            </div>
            <div>
              <dt>trading fee on the buy</dt>
              <dd>1.5%</dd>
            </div>
            <div className="total">
              <dt>from your wallet</dt>
              <dd>≈ {total} SOL</dd>
            </div>
          </dl>
        </Step>

        <div className="grid grid-cols-[40px_1fr] sm:grid-cols-[64px_1fr] gap-4 sm:gap-6">
          <span className="font-mono text-[11px] text-gold tracking-[0.2em]">05</span>
          <div>
            {errors.length > 0 && (
              <ul className="font-mono text-[11px] text-muted space-y-1 mb-5">
                {errors.map((e) => (
                  <li key={e}>
                    <span className="text-red">!</span> {e}
                  </li>
                ))}
              </ul>
            )}
            {id.address ? (
              <button
                onClick={() => setConfirm(true)}
                disabled={errors.length > 0}
                className="w-full h-16 bg-gold text-black font-display text-3xl tracking-wide hover:bg-white hover:shadow-[0_0_40px_rgba(183,95,224,0.55)] disabled:opacity-30 disabled:hover:bg-gold disabled:hover:shadow-none disabled:cursor-not-allowed active:translate-y-px transition"
              >
                Initiate launch
              </button>
            ) : (
              <div className="card p-4 flex flex-col sm:flex-row items-center gap-4">
                <span className="font-mono text-[11px] text-muted flex-1 leading-relaxed">Connect a Solana wallet holding a little SOL. The token is minted on mainnet.</span>
                <WalletMultiButton />
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 self-start">
        <LaunchPreview input={input} />
      </aside>

      <Modal open={confirm} onClose={() => !busy && setConfirm(false)} title={`Confirm $${form.ticker.toUpperCase()}`}>
        <div className="space-y-5">
          <LaunchPreview input={input} compact />
          <ul className="font-mono text-[11px] text-muted space-y-1.5 leading-relaxed">
            <li>· mints a real token on Solana mainnet, 1B supply, on the pump.fun curve</li>
            <li>· your {form.devBuySol.toFixed(2)} SOL first buy runs in the same transaction</li>
            <li>· your wallet asks for one approval, about {total} SOL in total</li>
            <li>· this cannot be undone</li>
          </ul>
          {step && <div className="font-mono text-[11px] text-gold cursor">{step}</div>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setConfirm(false)} disabled={busy} className="h-12 border border-line font-mono text-[11px] uppercase tracking-[0.2em] text-muted hover:text-white hover:border-white/40 transition">
              Back
            </button>
            <button onClick={launch} disabled={busy} className="h-12 bg-gold text-black font-mono text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white disabled:opacity-50 transition">
              {busy ? "Transmitting…" : "Send it"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
