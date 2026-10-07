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
  /**
   * Rannacher start-up: replace the first two steps with four fully implicit
   * half-steps, damping the payoff's kink so Crank–Nicolson keeps second order.
   */
  rannacher?: boolean;
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

export function solveBlackScholesPDE({ type, K, r, sigma, q = 0, T, nS, nT, Smax = 4 * K, theta = 0.5, american = false, rannacher = false }: FDInput): FDResult {
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
  // One θ-step of size h from `prev`, ending at time-to-expiry tau.
  const step = (prev: number[], h: number, th: number, tau: number): number[] => {
    const [lo, hi] = boundary(tau);
    const m = nS - 1; // interior unknowns i = 1..nS−1
    const a = new Array(m), b = new Array(m), c = new Array(m), d = new Array(m);
    for (let i = 1; i <= m; i++) {
      a[i - 1] = -th * h * alpha[i];
      b[i - 1] = 1 - th * h * beta[i];
      c[i - 1] = -th * h * gamma[i];
      d[i - 1] = prev[i] + (1 - th) * h * (alpha[i] * prev[i - 1] + beta[i] * prev[i] + gamma[i] * prev[i + 1]);
    }
    // Move known boundary values to the right-hand side.
    d[0] -= a[0] * lo;
    d[m - 1] -= c[m - 1] * hi;
    a[0] = 0;
    c[m - 1] = 0;
    const interior = th === 0 ? d.map((x, j) => x / b[j]) : thomas(a, b, c, d);
    const next = [lo, ...interior, hi];
    return american ? next.map((v, i) => Math.max(v, payoff(type, S[i], K))) : next;
  };
  for (let k = 1; k <= nT; k++) {
    const prev = V[k - 1];
    if (rannacher && k <= 2) {
      const mid = step(prev, dTau / 2, 1, (k - 0.5) * dTau);
      V.push(step(mid, dTau / 2, 1, k * dTau));
    } else {
      V.push(step(prev, dTau, theta, k * dTau));
    }
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

/**
 * Largest time step for which the explicit scheme (θ = 0) keeps every weight
 * non-negative, so errors can't grow: 1 + Δτ·β_i ≥ 0 at the top interior node,
 *   Δτ ≤ 1 / (σ²(n_S − 1)² + r).
 * Above it, the highest-frequency error mode is amplified at every step (Chapter 34).
 */
export function explicitStabilityLimit({ sigma, r, nS }: { sigma: number; r: number; nS: number }): number {
  return 1 / (sigma * sigma * (nS - 1) * (nS - 1) + r);
}
