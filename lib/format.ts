export const SOL_USD = 182.4;

export function compact(n: number, digits = 1) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(digits) + "B";
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(digits) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(digits) + "K";
  return sign + abs.toFixed(abs < 10 ? digits : 0);
}

export function fmtSol(n: number, digits = 2) {
  if (!isFinite(n)) return "0";
  if (Math.abs(n) >= 10000) return compact(n);
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtUsd(n: number) {
  return "$" + compact(n, 1);
}

export function fmtPct(n: number, digits = 1) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function fmtPrice(sol: number) {
  if (sol === 0) return "0";
  if (sol < 1e-6) return sol.toFixed(10).replace(/0+$/, "");
  if (sol < 0.001) return sol.toFixed(8).replace(/0+$/, "");
  return sol.toFixed(6);
}

export function fmtTokens(n: number) {
  return compact(n, 2);
}

export function shortAddr(addr: string, n = 4) {
  if (!addr) return "";
  if (addr.length <= n * 2 + 1) return addr;
  return `${addr.slice(0, n)}...${addr.slice(-n)}`;
}

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { h, m, s: sec, text: `${pad2(h)}:${pad2(m)}:${pad2(sec)}` };
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
