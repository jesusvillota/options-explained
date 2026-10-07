/**
 * Seeded pseudo-random numbers, so every simulation looks the same on every load.
 * mulberry32: small, fast, good enough for teaching (not for cryptography).
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draws via Box–Muller, from a seeded uniform source. */
export function normalRng(seed: number): Rng {
  const uniform = mulberry32(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = uniform();
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/**
 * Standard Brownian bridge on [0, 1] sampled at n+1 equally spaced times:
 * starts and ends at 0. Used to draw a realistic-looking path between two
 * fixed endpoints.
 */
export function brownianBridge(seed: number, n: number): number[] {
  const z = normalRng(seed);
  const dt = 1 / n;
  const w = [0];
  for (let i = 1; i <= n; i++) w.push(w[i - 1] + Math.sqrt(dt) * z());
  const w1 = w[n];
  return w.map((wi, i) => wi - (i / n) * w1);
}
