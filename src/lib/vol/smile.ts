import { cdf } from '../math/normal';

/**
 * Volatility smiles and surfaces (Chapters 26–27).
 *
 * Coordinates: log-moneyness k = ln(K/F) against the forward F, and total
 * implied variance w(k, T) = σ_imp(k, T)²·T.
 */

/** Raw SVI (Gatheral, 2004): w(k) = a + b(ρ(k − m) + √((k − m)² + s²)). */
export interface SVIParams {
  a: number;
  b: number;
  rho: number;
  m: number;
  s: number;
}

export function sviTotalVariance(k: number, { a, b, rho, m, s }: SVIParams): number {
  const x = k - m;
  return a + b * (rho * x + Math.sqrt(x * x + s * s));
}

/**
 * Surface SVI (Gatheral and Jacquier, 2014) with a power-law curvature:
 *   w(k, T) = θ/2 · (1 + ρφk + √((φk + ρ)² + 1 − ρ²)),  θ = σ_atm²·T,  φ = η/√θ.
 * Three numbers describe a whole surface: the at-the-money level, the skew ρ,
 * and the wing steepness η.
 */
export interface SSVIParams {
  /** At-the-money volatility for long maturities. */
  atmVol: number;
  /** Skew, in (−1, 1). Negative for equities. */
  rho: number;
  /** Curvature / wing level, > 0. */
  eta: number;
  /**
   * At-the-money volatility for very short maturities (defaults to atmVol, a flat term
   * structure). The ATM total variance blends the two: θ(T) = σ_L²T + (σ_S² − σ_L²)(1 − e^{−κT})/κ.
   */
  atmVolShort?: number;
}

export const EQUITY_SSVI: SSVIParams = { atmVol: 0.2, rho: -0.6, eta: 0.8 };

/** Speed (per year) at which the at-the-money term structure moves from short to long. */
const KAPPA = 2;

/** At-the-money total variance θ(T); increasing in T, so there's no calendar arbitrage at the money. */
export function atmTotalVariance(T: number, { atmVol, atmVolShort = atmVol }: SSVIParams): number {
  const long2 = atmVol * atmVol, short2 = atmVolShort * atmVolShort;
  return long2 * T + ((short2 - long2) * (1 - Math.exp(-KAPPA * T))) / KAPPA;
}

export function ssviTotalVariance(k: number, T: number, p: SSVIParams): number {
  const theta = atmTotalVariance(T, p);
  const phi = p.eta / Math.sqrt(theta);
  const x = phi * k;
  return (theta / 2) * (1 + p.rho * x + Math.sqrt((x + p.rho) ** 2 + 1 - p.rho * p.rho));
}

export function ssviVol(k: number, T: number, p: SSVIParams): number {
  return Math.sqrt(ssviTotalVariance(k, T, p) / T);
}

/**
 * Gatheral–Jacquier's sufficient conditions for no butterfly arbitrage in SSVI:
 * θφ(1 + |ρ|) < 4 and θφ²(1 + |ρ|) ≤ 4. With φ = η/√θ the first reads
 * η√θ(1 + |ρ|) < 4 and the second η²(1 + |ρ|) ≤ 4, independent of maturity.
 */
export function ssviButterflyFree(p: SSVIParams, T: number): boolean {
  const theta = atmTotalVariance(T, p);
  const r = 1 + Math.abs(p.rho);
  return p.eta * Math.sqrt(theta) * r < 4 && p.eta * p.eta * r <= 4;
}

/**
 * Gatheral's density function g(k) for a total-variance smile w(k):
 *   g = (1 − k w'/(2w))² − (w'²/4)(1/w + 1/4) + w''/2.
 * The risk-neutral density is non-negative exactly where g ≥ 0.
 */
export function densityFactor(w: (k: number) => number, k: number, h = 1e-3): number {
  const w0 = w(k);
  const w1 = (w(k + h) - w(k - h)) / (2 * h);
  const w2 = (w(k + h) - 2 * w0 + w(k - h)) / (h * h);
  return (1 - (k * w1) / (2 * w0)) ** 2 - ((w1 * w1) / 4) * (1 / w0 + 0.25) + w2 / 2;
}

/** Forward (undiscounted) call delta N(d₁) at log-moneyness k with total variance w: the "delta" axis traders use. */
export function forwardDelta(k: number, w: number): number {
  return cdf((-k + w / 2) / Math.sqrt(w));
}

/**
 * The log-moneyness whose forward call delta is `delta` on a smile w(k), found by
 * bisection (delta falls from 1 to 0 as k rises). Smiles are quoted in delta.
 */
export function logMoneynessForDelta(delta: number, w: (k: number) => number): number {
  let lo = -5, hi = 5;
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (lo + hi);
    if (forwardDelta(mid, w(mid)) > delta) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * The three numbers an FX or equity desk quotes for one maturity: at-the-money
 * vol, the 25-delta risk reversal σ(25Δ call) − σ(25Δ put), and the 25-delta
 * butterfly ½(σ(25Δ call) + σ(25Δ put)) − σ_ATM.
 */
export function smileQuotes(T: number, p: SSVIParams): { atm: number; rr25: number; bf25: number } {
  const w = (k: number) => ssviTotalVariance(k, T, p);
  const vol = (k: number) => Math.sqrt(w(k) / T);
  const atm = vol(0);
  const call25 = vol(logMoneynessForDelta(0.25, w));
  const put25 = vol(logMoneynessForDelta(0.75, w)); // a 25-delta put has call delta 0.75
  return { atm, rr25: call25 - put25, bf25: 0.5 * (call25 + put25) - atm };
}
