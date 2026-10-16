import { Dossier } from "@/components/coin/Dossier";
import { Intercepts } from "@/components/coin/Intercepts";
import { Ledger } from "@/components/coin/Ledger";
import { Hero } from "@/components/layout/Hero";

export default function HomePage() {
  return (
    <div className="space-y-14 pt-2">
      <Hero />
      <section id="coins" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted flex items-center gap-3">
          <span className="w-8 h-px bg-line" />
          files
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <Dossier />
          <Intercepts />
        </div>
      </section>
      <Ledger />
    </div>
  );
}
