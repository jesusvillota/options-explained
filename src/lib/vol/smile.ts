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
  /** At-the-money volatility (flat in maturity). */
  atmVol: number;
  /** Skew, in (−1, 1). Negative for equities. */
  rho: number;
  /** Curvature / wing level, > 0. */
  eta: number;
}

export const EQUITY_SSVI: SSVIParams = { atmVol: 0.2, rho: -0.7, eta: 1.0 };

export function ssviTotalVariance(k: number, T: number, { atmVol, rho, eta }: SSVIParams): number {
  const theta = atmVol * atmVol * T;
  const phi = eta / Math.sqrt(theta);
  const x = phi * k;
  return (theta / 2) * (1 + rho * x + Math.sqrt((x + rho) ** 2 + 1 - rho * rho));
}

export function ssviVol(k: number, T: number, p: SSVIParams): number {
  return Math.sqrt(ssviTotalVariance(k, T, p) / T);
}

/**
 * Gatheral–Jacquier's sufficient conditions for no butterfly arbitrage in SSVI:
 * θφ(1 + |ρ|) < 4 and θφ²(1 + |ρ|) ≤ 4. With φ = η/√θ the first reads
 * η√θ(1 + |ρ|) < 4 and the second η²(1 + |ρ|) ≤ 4, independent of maturity.
 */
export function ssviButterflyFree({ rho, eta, atmVol }: SSVIParams, T: number): boolean {
  const theta = atmVol * atmVol * T;
  return eta * Math.sqrt(theta) * (1 + Math.abs(rho)) < 4 && eta * eta * (1 + Math.abs(rho)) <= 4;
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
