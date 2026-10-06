import { LaunchForm } from "@/components/launch/LaunchForm";

export default function LaunchPage() {
  return (
    <div className="pt-6 space-y-6">
      <div>
        <h1 className="font-display text-4xl sm:text-6xl tracking-wide leading-none text-green glow-green">LAUNCH A COIN</h1>
        <p className="text-sm text-muted mt-2 max-w-2xl">
          One form, one wallet approval. Your token is created on Solana mainnet and starts trading on the pump.fun bonding curve immediately. Every buy through AlexPad is attributed to whoever drove it.
        </p>
      </div>
      <LaunchForm />
    </div>
  );
}
