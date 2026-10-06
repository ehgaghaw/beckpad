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

const X_URL = "https://x.com/ZssBecker";

function XLogo({ className = "" }: { className?: string }) {
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
    <header className="sticky top-0 z-40 border-b-4 border-plum">
      <LiveTicker />
      <div className="on-yellow bg-gold text-bg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center gap-2 sm:gap-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="BeckPad" width={44} height={44} className="w-11 h-11 rounded-md pixelated border-2 border-bg shadow-[3px_3px_0_0_#651a81] group-hover:-translate-y-0.5 transition" />
            <span className="hidden sm:inline font-display font-bold text-3xl tracking-wide leading-none">BECKPAD</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded-md text-sm font-bold tracking-wide transition ${
                  isActive(n.href) ? "bg-bg text-gold" : "text-bg/80 hover:text-bg hover:bg-bg/10"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          <Link
            href="/launch"
            className="h-10 px-3 sm:px-4 rounded-md bg-ice text-white font-display font-bold text-base sm:text-lg tracking-wider flex items-center gap-2 shadow-[3px_3px_0_0_#651a81] hover:brightness-110 active:translate-y-0.5 transition"
          >
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">LAUNCH A COIN</span>
          </Link>
          <WalletButton />
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="BeckPad on X"
            title="@ZssBecker on X"
            className="w-10 h-10 rounded-md bg-bg text-gold flex items-center justify-center shadow-[3px_3px_0_0_#651a81] hover:bg-plum hover:text-white active:translate-y-0.5 transition shrink-0"
          >
            <XLogo className="w-5 h-5" />
          </a>
        </div>
        <nav className="md:hidden flex items-center gap-1 px-4 pb-2 -mt-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1 rounded-md text-xs font-bold tracking-wide ${isActive(n.href) ? "bg-bg text-gold" : "text-bg/80"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
