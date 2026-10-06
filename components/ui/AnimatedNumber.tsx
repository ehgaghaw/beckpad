"use client";
import { useEffect, useRef, useState } from "react";

/** Tweens from the previous value to the new one and flashes green/red on change. */
export function AnimatedNumber({
  value,
  format = (n) => n.toFixed(0),
  duration = 600,
  className = "",
  flash = true,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
  flash?: boolean;
}) {
  const [display, setDisplay] = useState(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    setDir(to > from ? "up" : "down");
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else {
        prev.current = to;
        setTimeout(() => setDir(null), 600);
      }
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  const flashCls = flash && dir === "up" ? "animate-flash-green" : flash && dir === "down" ? "animate-flash-red" : "";
  return (
    <span className={`tabular rounded px-0.5 -mx-0.5 ${flashCls} ${className}`}>{format(display)}</span>
  );
}
