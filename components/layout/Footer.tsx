/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { X_URL, XLogo } from "./Header";

/** One row of the wall: ZEREPAD and the bust, repeated, doubled so the slide loops seamlessly. */
function WallRow({ rev = false, size }: { rev?: boolean; size: string }) {
  const unit = Array.from({ length: 6 }, (_, i) => (
    <span key={i}>
      ZEREPAD
      <img src="/zerebro.png" alt="" />
    </span>
  ));
  return (
    <div className={`wall-row ${rev ? "rev" : ""}`} style={{ fontSize: size }} aria-hidden>
      {unit}
      {unit}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16">
      <div className="wall py-1">
        <WallRow size="clamp(56px, 9vw, 120px)" />
        <WallRow rev size="clamp(56px, 9vw, 120px)" />
      </div>
      <div className="border-t border-line bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="ZerePad" width={32} height={32} className="w-8 h-8 pixelated border border-line" />
            <span className="font-display text-xl tracking-wide">ZEREPAD</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted hidden sm:inline cursor">signal acquired</span>
          </Link>
          <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <a href="https://github.com/ehgaghaw/beckpad" target="_blank" rel="noreferrer" className="hover:text-gold transition">
              Open source
            </a>
            <a href="https://pump.fun" target="_blank" rel="noreferrer" className="hover:text-gold transition">
              Powered by pump.fun
            </a>
            <a href={X_URL} target="_blank" rel="noreferrer" aria-label="@0xzerebro on X" className="w-9 h-9 border border-line flex items-center justify-center hover:text-gold hover:border-gold transition">
              <XLogo className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
