/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t-4 border-plum mt-8 bg-black/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="AlexPad" width={40} height={40} className="w-10 h-10 rounded pixelated border-2 border-line" />
          <span className="font-display font-bold text-lg tracking-wider text-gold">ALEXPAD</span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted">
          <a href="https://github.com/ehgaghaw/beckpad" target="_blank" rel="noreferrer" className="hover:text-gold">
            Open source
          </a>
          <a href="https://pump.fun" target="_blank" rel="noreferrer" className="hover:text-gold">
            Powered by pump.fun
          </a>
          <a
            href="https://x.com/ZssBecker"
            target="_blank"
            rel="noreferrer"
            aria-label="AlexPad on X"
            className="w-9 h-9 rounded-md border-2 border-line text-muted flex items-center justify-center hover:text-gold hover:border-gold transition"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="w-4 h-4" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
