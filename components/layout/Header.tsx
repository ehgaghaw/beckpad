"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveTicker } from "./LiveTicker";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/", label: "Coins" },
  { href: "/leaderboard", label: "Callers" },
  { href: "/launch", label: "Launch" },
];

export const X_URL = "https://x.com/0xzerebro";

export function XLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Header() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" || path.startsWith("/coin") : path.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <LiveTicker />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
        <Link href="/" className="flex items-center gap-3 group shrink-0" aria-label="ZerePad home">
          <img src="/logo.png" alt="" width={36} height={36} className="w-9 h-9 pixelated border border-line group-hover:border-gold transition" />
          <span className="glitch font-display text-[28px] leading-none tracking-wide" data-text="ZEREPAD">
            ZEREPAD
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              className={`group px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition ${isActive(n.href) ? "text-gold" : "text-muted hover:text-white"}`}
            >
              <span className="text-[9px] mr-1.5 opacity-50">0{i + 1}</span>
              {n.label}
              <span className={`block h-px mt-1 bg-gold transition-all ${isActive(n.href) ? "w-full" : "w-0 group-hover:w-full"}`} />
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <Link
          href="/launch"
          className="h-[38px] px-3 sm:px-4 bg-gold text-black font-mono text-[11px] font-bold uppercase tracking-[0.16em] flex items-center gap-2 hover:bg-white hover:shadow-[0_0_24px_rgba(183,95,224,0.6)] active:translate-y-px transition"
        >
          <span className="text-base leading-none">+</span>
          <span className="hidden sm:inline">Launch a coin</span>
        </Link>
        <WalletButton />
        <a
          href={X_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="@0xzerebro on X"
          title="@0xzerebro on X"
          className="w-[38px] h-[38px] border border-line text-muted flex items-center justify-center hover:text-gold hover:border-gold transition shrink-0"
        >
          <XLogo className="w-4 h-4" />
        </a>
      </div>
      <nav className="md:hidden flex items-center gap-1 px-3 pb-2 -mt-1">
        {NAV.map((n, i) => (
          <Link key={n.href} href={n.href} className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${isActive(n.href) ? "text-gold" : "text-muted"}`}>
            <span className="opacity-50 mr-1">0{i + 1}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
