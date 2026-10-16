import { LaunchForm } from "@/components/launch/LaunchForm";

export default function LaunchPage() {
  return (
    <div className="pt-10 sm:pt-14 space-y-10">
      <header className="grid grid-cols-1 lg:grid-cols-[1fr_auto] items-end gap-6 border-b border-line pb-8">
        <div>
          <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-muted">
            <span className="inline-block w-1.5 h-1.5 bg-gold mr-2 align-middle animate-pulse" />
            new transmission · solana mainnet
          </div>
          <h1 className="font-display leading-[0.85] text-[clamp(64px,11vw,150px)] mt-3">
            <span className="glitch" data-text="INITIATE">
              INITIATE
            </span>
          </h1>
          <p className="mt-4 max-w-xl font-mono text-xs sm:text-sm text-muted leading-relaxed">
            One form. One signature. The token is minted on Solana and starts trading on the pump.fun curve the moment it lands. Nothing here can be undone.
          </p>
        </div>
        <dl className="grid grid-cols-3 lg:grid-cols-1 gap-4 lg:gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted lg:text-right">
          <div>
            <dt>creation cost</dt>
            <dd className="text-white">~0.02 SOL</dd>
          </div>
          <div>
            <dt>graduates at</dt>
            <dd className="text-white">~85 SOL</dd>
          </div>
          <div>
            <dt>supply</dt>
            <dd className="text-white">1,000,000,000</dd>
          </div>
        </dl>
      </header>
      <LaunchForm />
    </div>
  );
}
