import { CoinOfTheHour } from "@/components/coin/CoinOfTheHour";
import { MoneyPrinter } from "@/components/coin/MoneyPrinter";
import { CoinGrid } from "@/components/coin/CoinGrid";

export default function HomePage() {
  return (
    <div className="space-y-8 pt-6">
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <CoinOfTheHour />
        </div>
        <div className="lg:col-span-2">
          <MoneyPrinter />
        </div>
      </section>
      <CoinGrid />
    </div>
  );
}
