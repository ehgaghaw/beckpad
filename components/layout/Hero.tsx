"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { X_URL } from "./Header";

const GLYPHS = "▓▒░█<>/\\|01#$%&*+=?ZEREPADX";

/** Text that resolves out of noise, left to right. Re-runs every `every` ms if given. */
function Decode({ text, delay = 0, every }: { text: string; delay?: number; every?: number }) {
  const [out, setOut] = useState(text.replace(/\S/g, " "));
  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      const start = performance.now();
      const dur = 900 + text.length * 18;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const fixed = Math.floor(p * text.length);
        setOut(
          text
            .split("")
            .map((ch, i) => (i < fixed || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
            .join(""),
        );
        if (p < 1) raf = requestAnimationFrame(tick);
        else if (every) timer = setTimeout(run, every);
      };
      raf = requestAnimationFrame(tick);
    };
    timer = setTimeout(run, delay);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [text, delay, every]);
  return <span aria-label={text}>{out}</span>;
}

/** A hex-ish signal id that keeps changing, for the terminal header. */
function Signal() {
  const [v, setV] = useState("0x0000");
  useEffect(() => {
    const t = setInterval(() => setV(`0x${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")}`), 1400);
    return () => clearInterval(t);
  }, []);
  return <span className="text-gold">{v}</span>;
}

export function Hero() {
  return (
    <section className="relative grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] items-center gap-6 lg:gap-10 pt-10 sm:pt-14 pb-4">
      <div className="relative z-10 order-2 lg:order-1">
        <p className="rise font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-muted" style={{ ["--d" as string]: "0.05s" }}>
          <span className="inline-block w-1.5 h-1.5 bg-gold mr-2 align-middle animate-pulse" />
          transmission <Signal /> · solana mainnet
        </p>
        <h1 className="rise mt-4 font-display leading-[0.82] tracking-tight text-[clamp(84px,15vw,200px)]" style={{ ["--d" as string]: "0.15s" }}>
          <span className="glitch" data-text="ZEREPAD">
            ZEREPAD
          </span>
        </h1>
        <p className="rise mt-5 font-mono text-sm sm:text-base uppercase tracking-[0.2em] text-gold cursor" style={{ ["--d" as string]: "0.3s" }}>
          <Decode text="something is launching." delay={500} every={9000} />
        </p>
        <div className="rise mt-7 flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "0.6s" }}>
          <Link href="/launch" className="h-11 px-6 bg-gold text-black font-mono text-xs font-bold uppercase tracking-[0.18em] flex items-center gap-2 hover:bg-white hover:shadow-[0_0_30px_rgba(183,95,224,0.6)] transition">
            + Launch a coin
          </Link>
          <a href="#coins" className="h-11 px-6 border border-line font-mono text-xs uppercase tracking-[0.18em] flex items-center hover:border-gold hover:text-gold transition">
            Enter the void ↓
          </a>
          <a href={X_URL} target="_blank" rel="noreferrer" className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted hover:text-gold transition px-2">
            @0xzerebro ↗
          </a>
        </div>
        <div className="rise mt-8 grid grid-cols-3 max-w-md border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted" style={{ ["--d" as string]: "0.75s" }}>
          <span>
            status
            <br />
            <span className="text-green">● online</span>
          </span>
          <span>
            venue
            <br />
            <span className="text-white">pump.fun</span>
          </span>
          <span>
            origin
            <br />
            <span className="text-white">unknown</span>
          </span>
        </div>
      </div>
      <div className="relative order-1 lg:order-2 mx-auto w-[min(78vw,460px)]">
        <div className="bust rise" style={{ ["--d" as string]: "0.1s" }}>
          <img src="/zerebro.png" alt="" width={400} height={400} />
          <img className="ghost c" src="/zerebro.png" alt="" width={400} height={400} />
          <img className="ghost m" src="/zerebro.png" alt="" width={400} height={400} />
        </div>
        <span className="absolute left-0 top-4 font-mono text-[9px] uppercase tracking-[0.2em] text-muted/70">[ subject 00 ]</span>
        <span className="absolute right-0 bottom-6 font-mono text-[9px] uppercase tracking-[0.2em] text-muted/70">identity: withheld</span>
      </div>
    </section>
  );
}
