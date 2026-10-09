import { normalRng } from '../math/rng';

/**
 * Microstructure noise and realised volatility (Chapter 72). The observed log
 * price is the efficient log price plus noise, Y = X + ε, with X a Brownian
 * motion with volatility σ and ε independent N(0, ω²) (bid–ask bounce,
 * discreteness). Sampling more often adds more noise than information:
 *   E[RV_n] = σ²T + 2nω².
 * Time is in trading days; σ is a daily volatility.
 */

export const TICKS_PER_DAY = 23400; // one observation a second over 6.5 hours

export function simulateNoisyDay(o: { sigmaDaily: number; omega: number; seed: number; ticks?: number }): { efficient: number[]; observed: number[] } {
  const { sigmaDaily, omega, seed, ticks = TICKS_PER_DAY } = o;
  const z = normalRng(seed), e = normalRng(seed + 101);
  const dt = 1 / ticks, sd = sigmaDaily * Math.sqrt(dt);
  const efficient = [0], observed = [omega * e()];
  let x = 0;
  for (let i = 1; i <= ticks; i++) {
    x += sd * z();
    efficient.push(x);
    observed.push(x + omega * e());
  }
  return { efficient, observed };
}

/** Realised variance from every k-th observation, starting at offset s. */
export function realizedVariance(y: number[], k = 1, s = 0): number {
  let rv = 0;
  for (let i = s + k; i < y.length; i += k) rv += (y[i] - y[i - k]) ** 2;
  return rv;
}

/** Expected realised variance with n returns over a day: σ² + 2nω². */
export const expectedRV = (sigmaDaily: number, omega: number, n: number) => sigmaDaily ** 2 + 2 * n * omega ** 2;

/** Noise variance estimated from the highest-frequency realised variance: RV_all / (2n). */
export const noiseVariance = (y: number[]) => realizedVariance(y) / (2 * (y.length - 1));

/**
 * Bandi–Russell rule of thumb: the number of returns minimising the mean
 * squared error of RV, n* = (σ²T / (2ω²))^{2/3} for constant volatility.
 */
export const optimalSamples = (sigmaDaily: number, omega: number) => (sigmaDaily ** 2 / (2 * omega ** 2)) ** (2 / 3);

/**
 * Two-scale realised variance (Zhang, Mykland and Aït-Sahalia 2005): average
 * the realised variances of K sparse subgrids, then remove the noise bias
 * estimated from the full grid,
 *   TSRV = RV_avg − (n̄ / n) RV_all, with n̄ = (n − K + 1) / K.
 */
export function twoScaleRV(y: number[], K?: number): number {
  const n = y.length - 1;
  const k = K ?? Math.max(2, Math.round(Math.pow(n, 2 / 3) / 2));
  let avg = 0;
  for (let s = 0; s < k; s++) avg += realizedVariance(y, k, s);
  avg /= k;
  const nBar = (n - k + 1) / k;
  return avg - (nBar / n) * realizedVariance(y);
}

/** Annualised volatility from a daily variance. */
export const annualise = (dailyVar: number) => Math.sqrt(Math.max(dailyVar, 0) * 252);
