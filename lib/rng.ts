/** Deterministic PRNG (mulberry32) so mock data is identical on server and client. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number) => next() * (max - min) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    /** Skewed towards small values (power law) */
    skew: (min: number, max: number, power = 3) => min + (max - min) * Math.pow(next(), power),
  };
}

export type Rng = ReturnType<typeof createRng>;

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function fakeAddress(rng: Rng, len = 44) {
  let s = "";
  for (let i = 0; i < len; i++) s += BASE58[Math.floor(rng.next() * BASE58.length)];
  return s;
}

export function fakeId(rng: Rng) {
  return fakeAddress(rng, 12);
}
