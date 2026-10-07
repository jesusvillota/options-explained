import { normalRng } from '../math/rng';
import { densityFactor, ssviTotalVariance, type SSVIParams } from '../vol/smile';

/**
 * Local volatility (Dupire, 1994; Chapter 29). In terms of total implied
 * variance w(k, T) with k = ln(K/F_T), Dupire's formula reads (Gatheral):
 *   σ_loc²(K, T) = ∂_T w(k, T) / g(k, T),
 * where g is the density factor of Chapter 27.
 */
export type TotalVariance = (k: number, T: number) => number;
export type LocalVolFn = (S: number, t: number) => number;

const LV_MIN = 0.01, LV_MAX = 2;

export function localVolFromSurface(w: TotalVariance, k: number, T: number, dT = 1e-4): number {
  const wT = (w(k, T + dT) - w(k, Math.max(T - dT, 1e-6))) / (T + dT - Math.max(T - dT, 1e-6));
  const g = densityFactor((x) => w(x, T), k);
  const v = wT / g;
  if (!(v > 0) || !Number.isFinite(v)) return LV_MAX;
  return Math.min(Math.max(Math.sqrt(v), LV_MIN), LV_MAX);
}

/** Local vol as a function of stock price and time, for an SSVI surface on a stock with spot S0. */
export function ssviLocalVol(p: SSVIParams, S0: number, r: number, q = 0): LocalVolFn {
  const w: TotalVariance = (k, T) => ssviTotalVariance(k, T, p);
  return (S, t) => {
    const T = Math.max(t, 1 / 365);
    return localVolFromSurface(w, Math.log(S / (S0 * Math.exp((r - q) * T))), T);
  };
}

/** A seeded local-volatility path: log-Euler with σ_loc evaluated at the start of each step. */
export function localVolPath(seed: number, S0: number, mu: number, sigma: LocalVolFn, T: number, n: number): { S: number[]; vol: number[] } {
  const z = normalRng(seed);
  const dt = T / n;
  const S = [S0], vol: number[] = [];
  let x = Math.log(S0);
  for (let i = 0; i < n; i++) {
    const s = sigma(Math.exp(x), i * dt);
    vol.push(s);
    x += (mu - 0.5 * s * s) * dt + s * Math.sqrt(dt) * z();
    S.push(Math.exp(x));
  }
  vol.push(sigma(Math.exp(x), T));
  return { S, vol };
}

function thomas(a: number[], b: number[], c: number[], d: number[]): number[] {
  const n = d.length;
  const cp = new Array<number>(n), dp = new Array<number>(n);
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / m;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  const x = new Array<number>(n);
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

export interface DupireGrid {
  /** Strikes K_i = i·ΔK. */
  K: number[];
  /** Call prices C(K_i, T) at the final maturity. */
  C: number[];
}

/**
 * Dupire's forward equation, solved in (K, T) from today's spot:
 *   ∂_T C = ½σ_loc²(K, T)K² ∂_KK C − (r − q)K ∂_K C − qC,   C(K, 0) = (S0 − K)⁺.
 * One solve gives call prices for every strike at maturity T. Crank–Nicolson,
 * with four fully implicit start-up steps to damp the payoff's kink (Rannacher).
 */
export function dupireForward(S0: number, r: number, q: number, sigma: LocalVolFn, T: number, { Kmax = 3 * S0, nK = 300, nT = 120 } = {}): DupireGrid {
  const dK = Kmax / nK, dT = T / nT;
  const K = Array.from({ length: nK + 1 }, (_, i) => i * dK);
  let C = K.map((k) => Math.max(S0 - k, 0));
  // Four implicit half-steps cover the first two steps, then Crank–Nicolson.
  const steps: { h: number; theta: number }[] = [
    ...Array.from({ length: 4 }, () => ({ h: dT / 2, theta: 1 })),
    ...Array.from({ length: Math.max(nT - 2, 0) }, () => ({ h: dT, theta: 0.5 })),
  ];
  let tNew = 0;
  for (const { h, theta } of steps) {
    tNew += h;
    const tMid = tNew - h / 2;
    const m = nK - 1;
    const a = new Array<number>(m), b = new Array<number>(m), c = new Array<number>(m), d = new Array<number>(m);
    for (let i = 1; i < nK; i++) {
      const s = sigma(K[i], tMid);
      const diff = 0.5 * s * s * i * i; // ½σ²K²/ΔK² with K = iΔK
      const conv = 0.5 * (r - q) * i; // (r − q)K/(2ΔK)
      // L C_i = lo C_{i−1} + mid C_i + hi C_{i+1}
      const lo = diff + conv, mid = -2 * diff - q, hi = diff - conv;
      const j = i - 1;
      a[j] = -theta * h * lo;
      b[j] = 1 - theta * h * mid;
      c[j] = -theta * h * hi;
      d[j] = C[i] + (1 - theta) * h * (lo * C[i - 1] + mid * C[i] + hi * C[i + 1]);
    }
    const left = S0 * Math.exp(-q * tNew); // C(0, T): a call struck at zero is the stock, less dividends
    d[0] -= a[0] * left;
    const inner = thomas(a, b, c, d);
    C = [left, ...inner, 0];
  }
  return { K, C };
}

/** Linear interpolation of a Dupire grid at strike K. */
export function dupirePrice(grid: DupireGrid, K: number): number {
  const dK = grid.K[1] - grid.K[0];
  const i = Math.min(Math.max(Math.floor(K / dK), 0), grid.K.length - 2);
  const t = (K - grid.K[i]) / dK;
  return grid.C[i] * (1 - t) + grid.C[i + 1] * t;
}
