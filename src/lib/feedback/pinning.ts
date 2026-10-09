import { normalRng, mulberry32 } from '../math/rng';
import { pdf } from '../math/normal';
import { FLOOR } from './dealerGamma';

/**
 * Pinning at expiry (Chapter 67). Hedgers hold n contracts at strike K
 * (positive = long gamma) that expire at the close. Their gamma near the
 * strike explodes as expiry nears, Γ ≈ φ(d₁)/(Sσ√τ), and with price impact λ the
 * stock's local volatility becomes σ / (1 + λ n·100·Γ(S, τ)). Long-gamma hedging
 * freezes the stock near the strike; short-gamma hedging pushes it away.
 */

export const PIN = { K: 100, sigma: 0.2, days: 5, stepsPerDay: 78 };

/** Black–Scholes gamma per share with zero rates, safe as τ → 0. */
export function gammaAt(S: number, K: number, sigma: number, tau: number): number {
  if (tau <= 0) return 0;
  const s = sigma * Math.sqrt(tau);
  const d1 = (Math.log(S / K) + 0.5 * s * s) / s;
  return pdf(d1) / (S * s);
}

/** Local volatility multiplier 1/(1 + λ n·100·Γ), floored for short gamma as in Chapter 66. */
export function localMultiplier(S: number, tau: number, contracts: number, lambda: number, K = PIN.K, sigma = PIN.sigma): number {
  return 1 / Math.max(1 + lambda * contracts * 100 * gammaAt(S, K, sigma, tau), FLOOR);
}

export interface PinOptions {
  paths: number;
  seed: number;
  /** Hedgers' net contracts at the strike (positive = long gamma). */
  contracts: number;
  /** Price impact, dollars per share. */
  lambda: number;
  /** Spread of starting prices around the strike, dollars (uniform). */
  startSpread?: number;
}

/**
 * Closing prices over many seeded paths of the last few trading days, with and
 * without the hedgers' feedback, from the same starting prices and shocks.
 */
export function simulatePinning(o: PinOptions): { free: number[]; hedged: number[] } {
  const { paths, seed, contracts, lambda, startSpread = 4 } = o;
  const { K, sigma, days, stepsPerDay } = PIN;
  const n = days * stepsPerDay, dt = 1 / (252 * stepsPerDay);
  const u = mulberry32(seed), z = normalRng(seed + 1);
  const free: number[] = [], hedged: number[] = [];
  for (let p = 0; p < paths; p++) {
    let F = K + (u() - 0.5) * startSpread, S = F;
    for (let k = 0; k < n; k++) {
      const r = sigma * Math.sqrt(dt) * z();
      const tau = (n - k) * dt;
      F *= 1 + r;
      S *= 1 + r * localMultiplier(S, tau, contracts, lambda);
    }
    free.push(F);
    hedged.push(S);
  }
  return { free, hedged };
}

/** Share of closes within ±width of the strike. */
export const pinShare = (closes: number[], width: number, K = PIN.K) => closes.filter((c) => Math.abs(c - K) <= width).length / closes.length;

/** Histogram of closes minus the strike: share of paths per bin. */
export function closeHistogram(closes: number[], lo: number, hi: number, bins: number, K = PIN.K): number[] {
  const h = new Array(bins).fill(0), w = (hi - lo) / bins;
  for (const c of closes) {
    const b = Math.floor((c - K - lo) / w);
    if (b >= 0 && b < bins) h[b]++;
  }
  return h.map((v) => v / closes.length);
}
