import type { Smile } from './density';
import { forwardOf, smilePrice } from './density';
import type { MarketInput } from './impliedVol';

/**
 * The payoff a variance swap's hedge must replicate (Chapter 28):
 *   f(S_T) = (S_T − F)/F − ln(S_T/F) ≥ 0,
 * a forward position minus a log contract. It is convex and zero at S_T = F.
 */
export const logContractPayoff = (ST: number, F: number) => (ST - F) / F - Math.log(ST / F);

/**
 * Strike spacings in the style of the VIX white paper: ΔK_i is half the gap
 * between the neighbouring strikes, and the full gap at either end.
 */
export function strikeSpacings(strikes: number[]): number[] {
  const n = strikes.length;
  return strikes.map((_, i) => {
    if (n === 1) return 0;
    if (i === 0) return strikes[1] - strikes[0];
    if (i === n - 1) return strikes[n - 1] - strikes[n - 2];
    return 0.5 * (strikes[i + 1] - strikes[i - 1]);
  });
}

/**
 * The payoff of a static strip of out-of-the-money options with weights ΔK/K²:
 * puts struck below F, calls above, and both halves at F. It approximates logContractPayoff
 * as the strikes get denser and wider.
 */
export function stripPayoff(ST: number, F: number, strikes: number[]): number {
  const dK = strikeSpacings(strikes);
  let total = 0;
  strikes.forEach((K, i) => {
    const put = Math.max(K - ST, 0), call = Math.max(ST - K, 0);
    // A strike exactly at the forward is half put, half call, so each side covers its half of the gap.
    const pay = Math.abs(K - F) < 1e-9 * F ? 0.5 * (put + call) : K < F ? put : call;
    total += (dK[i] / (K * K)) * pay;
  });
  return total;
}

/**
 * Fair variance-swap strike from a smile:
 *   K_var = (2e^{rT}/T) ∫₀^∞ Q(K)/K² dK,
 * where Q is the out-of-the-money option price (put below F, call above).
 * Integrated in log-strike with the trapezoid rule over ±kWidth total-vol widths.
 */
export function fairVariance(market: MarketInput, smile: Smile, n = 2000, kWidth = 10): number {
  const F = forwardOf(market);
  const width = kWidth * smile(0) * Math.sqrt(market.T);
  let sum = 0;
  const dk = (2 * width) / n;
  for (let i = 0; i <= n; i++) {
    const k = -width + i * dk;
    const K = F * Math.exp(k);
    const Q = smilePrice(k < 0 ? 'put' : 'call', K, market, smile);
    // dK/K² = e^{−k} dk / F
    const term = (Q * Math.exp(-k)) / F;
    sum += (i === 0 || i === n ? 0.5 : 1) * term;
  }
  return ((2 * Math.exp(market.r * market.T)) / market.T) * sum * dk;
}

export interface VixTerm {
  K: number;
  /** Out-of-the-money option used at this strike (both at K₀). */
  kind: 'put' | 'call' | 'both';
  /** Its price Q(K): the put, the call, or their average at K₀. */
  Q: number;
  /** This strike's share of σ²: (2/T)·ΔK/K²·e^{rT}·Q. */
  contribution: number;
}

/**
 * The VIX formula (Cboe white paper) on a discrete set of strikes:
 *   σ² = (2/T) Σ ΔK_i/K_i² e^{rT} Q(K_i) − (1/T)(F/K₀ − 1)²,
 * with K₀ the first strike at or below F, where Q is the average of the put and call.
 * Returns each strike's term and the correction.
 */
export function vixTerms(market: MarketInput, smile: Smile, strikes: number[]): { terms: VixTerm[]; correction: number; F: number; K0: number } {
  const F = forwardOf(market);
  const { T, r } = market;
  const below = strikes.filter((K) => K <= F);
  const K0 = below.length ? below[below.length - 1] : strikes[0];
  const dK = strikeSpacings(strikes);
  const terms = strikes.map((K, i): VixTerm => {
    const kind = K < K0 ? 'put' : K > K0 ? 'call' : 'both';
    const Q = kind === 'both'
      ? 0.5 * (smilePrice('put', K, market, smile) + smilePrice('call', K, market, smile))
      : smilePrice(kind, K, market, smile);
    return { K, kind, Q, contribution: ((2 / T) * dK[i] * Math.exp(r * T) * Q) / (K * K) };
  });
  return { terms, correction: (1 / T) * (F / K0 - 1) ** 2, F, K0 };
}

/** σ² from the VIX formula; 100·√σ² is the index level. */
export function vixVariance(market: MarketInput, smile: Smile, strikes: number[]): number {
  const { terms, correction } = vixTerms(market, smile, strikes);
  return terms.reduce((a, t) => a + t.contribution, 0) - correction;
}

/**
 * Realised variance as a variance swap measures it: annualised mean of squared
 * daily log returns, with no mean subtracted (the market convention).
 */
export function realisedVariance(prices: number[], periodsPerYear = 252): number {
  let sum = 0;
  for (let i = 1; i < prices.length; i++) sum += Math.log(prices[i] / prices[i - 1]) ** 2;
  return (periodsPerYear * sum) / (prices.length - 1);
}
