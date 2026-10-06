"use client";

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; badge?: string | number }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex p-1 rounded-lg bg-black/60 border border-line gap-1 max-w-full overflow-x-auto scrollbar-thin">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`${size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 sm:px-4 text-sm"} rounded-md font-display tracking-wider whitespace-nowrap transition ${
              active ? "bg-gold text-black box-glow-gold" : "text-muted hover:text-white hover:bg-white/5"
            }`}
          >
            {o.label}
            {o.badge !== undefined && (
              <span className={`ml-1.5 text-[10px] font-sans font-bold ${active ? "text-black/70" : "text-muted"}`}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
