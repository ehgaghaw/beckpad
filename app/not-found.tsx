import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="pt-16">
      <EmptyState icon="🕳️" title="404 · EXIT LIQUIDITY" body="That page rugged. Head back to the curve." action={{ href: "/", label: "BACK TO COINS" }} />
    </div>
  );
}
