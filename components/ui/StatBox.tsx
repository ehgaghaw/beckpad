export function StatBox({
  label,
  children,
  sub,
  tone = "default",
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "gold" | "green" | "red" | "ice";
  className?: string;
}) {
  const color =
    tone === "gold" ? "text-gold glow-gold" : tone === "green" ? "text-green glow-green" : tone === "red" ? "text-red glow-red" : tone === "ice" ? "text-ice" : "text-white";
  return (
    <div className={`rounded-lg bg-black/40 border border-line p-3 ${className}`}>
      <div className="stat-label">{label}</div>
      <div className={`font-display text-2xl sm:text-3xl leading-tight ${color}`}>{children}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
