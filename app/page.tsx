import { CoinOfTheHour } from "@/components/coin/CoinOfTheHour";
import { MoneyPrinter } from "@/components/coin/MoneyPrinter";
import { CoinGrid } from "@/components/coin/CoinGrid";
import { Hero } from "@/components/layout/Hero";

export default function HomePage() {
  return (
    <div className="space-y-10 pt-2">
      <Hero />
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <CoinOfTheHour />
        </div>
        <div className="lg:col-span-2">
          <MoneyPrinter />
        </div>
      </section>
      <div id="coins" className="scroll-mt-28">
        <CoinGrid />
      </div>
    </div>
  );
}
