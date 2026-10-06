"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useIdentity } from "@/lib/wallet";
import { Modal } from "@/components/ui/Modal";
import { CoinAvatar } from "@/components/ui/CoinAvatar";
import { LaunchPreview } from "./LaunchPreview";
import type { LaunchInput } from "@/types";

const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), { ssr: false });

const EMOJIS = ["🪙", "🧠", "🖨️", "🚀", "🐸", "🐶", "🐋", "💎", "🔥", "🎯", "👑", "🗿", "🧬", "🎮", "🌕", "🦍"];

export function LaunchForm() {
  const id = useIdentity();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<LaunchInput>({
    name: "",
    ticker: "",
    description: "",
    emoji: "🪙",
    imageUrl: undefined,
    socials: {},
    devBuySol: 0.5,
    devLock: true,
    creator: "",
  });
  const input: LaunchInput = { ...form, creator: id.address ?? "" };
  const set = <K extends keyof LaunchInput>(k: K, v: LaunchInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const errors: string[] = [];
  if (form.name.trim().length < 2) errors.push("Name needs at least 2 characters");
  if (!/^[A-Za-z0-9]{2,8}$/.test(form.ticker)) errors.push("Ticker: 2–8 letters/numbers");
  if (form.description.trim().length < 10) errors.push("Description needs at least 10 characters");
  if (form.devBuySol < 0 || form.devBuySol > 20) errors.push("Dev buy must be 0–20 SOL");

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
    const t = toast.loading(`Launching $${form.ticker.toUpperCase()}…`, { description: "Creating mint + bonding curve (simulated)" });
    try {
      const coin = await api.launchCoin(input);
      toast.success(`$${coin.ticker} is live!`, { id: t, description: coin.devLock ? "Dev lock badge applied." : undefined });
      setConfirm(false);
      router.push(`/coin/${coin.mint}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Launch failed", { id: t });
      setBusy(false);
    }
  };

  const field = "w-full h-11 px-3 rounded-lg bg-black/60 border border-line text-sm focus:outline-none focus:border-gold";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-5">
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="font-display text-xl tracking-[0.2em] text-gold">1 · IDENTITY</div>
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
                    onChange={(e) => set("ticker", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    placeholder="BRRR"
                    className={`${field} font-display text-lg tracking-widest`}
                  />
                </div>
              </div>
              <div>
                <label className="stat-label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="What's the lore? Why will this print?"
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-line text-sm focus:outline-none focus:border-gold resize-none"
                />
                <div className="text-[10px] text-muted text-right">{form.description.length}/280</div>
              </div>
              {!form.imageUrl && (
                <div>
                  <label className="stat-label">No image? Pick an emoji</label>
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
          <div className="font-display text-xl tracking-[0.2em] text-gold">2 · SOCIALS</div>
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
          <div className="font-display text-xl tracking-[0.2em] text-gold">3 · DEV BUY & LOCK</div>
          <div>
            <div className="flex items-center justify-between">
              <label className="stat-label">Optional dev buy</label>
              <span className="font-display text-2xl text-green tabular">{form.devBuySol.toFixed(2)} SOL</span>
            </div>
            <input type="range" min={0} max={10} step={0.05} value={form.devBuySol} onChange={(e) => set("devBuySol", parseFloat(e.target.value))} className="w-full" />
            <p className="text-[11px] text-muted">Buys your own first tokens at launch. Big dev buys tank the Rug Check score unless locked.</p>
          </div>
          <label className="flex items-center justify-between gap-4 p-3 rounded-lg border border-line bg-black/40 cursor-pointer">
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                🔒 Dev lock
                {form.devLock && <span className="text-[10px] font-bold tracking-widest text-green border border-green/40 bg-green/10 px-1.5 py-0.5 rounded">BADGE ON</span>}
              </div>
              <div className="text-[11px] text-muted">Lock dev tokens for 90 days. Locked devs get a visible badge on every card and a Rug Check boost.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.devLock}
              onClick={() => set("devLock", !form.devLock)}
              className={`w-14 h-8 rounded-full p-1 transition ${form.devLock ? "bg-green" : "bg-line"}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-black transition ${form.devLock ? "translate-x-6" : ""}`} />
            </button>
          </label>
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
            className="w-full h-14 rounded-lg bg-green text-black font-display text-2xl tracking-widest box-glow-green hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition"
          >
            REVIEW & LAUNCH
          </button>
        ) : (
          <div className="card p-4 flex flex-col sm:flex-row items-center gap-3">
            <span className="text-sm text-muted flex-1">Connect a wallet to launch, or use a demo wallet to try it.</span>
            <WalletMultiButton />
            <button onClick={() => id.enableDemo()} className="h-10 px-4 rounded-lg border border-green/50 text-green font-display text-lg tracking-wider hover:bg-green/10">
              DEMO WALLET
            </button>
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
            <li>• Mint created with 1B supply, all on the bonding curve.</li>
            <li>• Dev buy of {form.devBuySol.toFixed(2)} SOL executes in the same transaction{form.devLock ? " and is locked for 90 days" : ""}.</li>
            <li>• Trades are simulated off-chain for now. No real SOL is spent.</li>
          </ul>
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)} disabled={busy} className="flex-1 h-12 rounded-lg border border-line font-display text-xl tracking-widest text-muted hover:text-white">
              BACK
            </button>
            <button onClick={launch} disabled={busy} className="flex-1 h-12 rounded-lg bg-green text-black font-display text-xl tracking-widest box-glow-green disabled:opacity-50">
              {busy ? "LAUNCHING…" : "SEND IT 🚀"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
