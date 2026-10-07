import type { OptionType } from '../pricing/payoff';
import { payoff } from '../pricing/payoff';

/**
 * Finite-difference solution of the Black–Scholes PDE
 *   V_τ = ½σ²S² V_SS + (r − q) S V_S − r V,   V(S, 0) = payoff(S),
 * in time-to-expiry τ, on a uniform S-grid [0, S_max] (Chapters 19 and 34).
 */
export interface FDInput {
  type: OptionType;
  K: number;
  r: number;
  sigma: number;
  q?: number;
  /** Time to expiry to solve up to. */
  T: number;
  /** Grid size in S (number of intervals) and in time. */
  nS: number;
  nT: number;
  Smax?: number;
  /** θ = 0: explicit, θ = 1: fully implicit, θ = ½: Crank–Nicolson. */
  theta?: number;
  american?: boolean;
}

export interface FDResult {
  S: number[];
  /** V[k][i] = value at time-to-expiry k·Δτ and S[i]; V[0] is the payoff. */
  V: number[][];
  dTau: number;
}

/** Solve a tridiagonal system with the Thomas algorithm. a: sub, b: diag, c: super. */
function thomas(a: number[], b: number[], c: number[], d: number[]): number[] {
  const n = d.length;
  const cp = new Array(n).fill(0);
  const dp = new Array(n).fill(0);
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / m;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  const x = new Array(n).fill(0);
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

export function solveBlackScholesPDE({ type, K, r, sigma, q = 0, T, nS, nT, Smax = 4 * K, theta = 0.5, american = false }: FDInput): FDResult {
  const dS = Smax / nS;
  const dTau = T / nT;
  const S = Array.from({ length: nS + 1 }, (_, i) => i * dS);
  const V: number[][] = [S.map((s) => payoff(type, s, K))];
  // Spatial operator L V_i = α_i V_{i−1} + β_i V_i + γ_i V_{i+1}
  const alpha = S.map((_, i) => 0.5 * sigma * sigma * i * i - 0.5 * (r - q) * i);
  const beta = S.map((_, i) => -sigma * sigma * i * i - r);
  const gamma = S.map((_, i) => 0.5 * sigma * sigma * i * i + 0.5 * (r - q) * i);
  const boundary = (tau: number): [number, number] =>
    type === 'call'
      ? [0, Smax * Math.exp(-q * tau) - K * Math.exp(-r * tau)]
      : [K * Math.exp(-r * tau), 0];
  for (let k = 1; k <= nT; k++) {
    const prev = V[k - 1];
    const tau = k * dTau;
    const [lo, hi] = boundary(tau);
    const m = nS - 1; // interior unknowns i = 1..nS−1
    const a = new Array(m), b = new Array(m), c = new Array(m), d = new Array(m);
    for (let i = 1; i <= m; i++) {
      const explicitPart = prev[i] + (1 - theta) * dTau * (alpha[i] * prev[i - 1] + beta[i] * prev[i] + gamma[i] * prev[i + 1]);
      a[i - 1] = -theta * dTau * alpha[i];
      b[i - 1] = 1 - theta * dTau * beta[i];
      c[i - 1] = -theta * dTau * gamma[i];
      d[i - 1] = explicitPart;
    }
    // Move known boundary values to the right-hand side.
    d[0] -= a[0] * lo;
    d[m - 1] -= c[m - 1] * hi;
    a[0] = 0;
    c[m - 1] = 0;
    const interior = theta === 0 ? d.map((x, j) => x / b[j]) : thomas(a, b, c, d);
    let next = [lo, ...interior, hi];
    if (american) next = next.map((v, i) => Math.max(v, payoff(type, S[i], K)));
    V.push(next);
  }
  return { S, V, dTau };
}

/** Linear interpolation of a grid solution at stock price s. */
export function interpolate(S: number[], values: number[], s: number): number {
  const dS = S[1] - S[0];
  const i = Math.min(Math.max(Math.floor(s / dS), 0), S.length - 2);
  const w = (s - S[i]) / dS;
  return values[i] * (1 - w) + values[i + 1] * w;
}
