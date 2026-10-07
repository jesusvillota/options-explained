import { bisection } from '../math/rootFind';
import { greeks, price, type BSInput } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';

/** Everything Black–Scholes needs except the volatility. */
export type MarketInput = Omit<BSInput, 'sigma'>;

/**
 * No-arbitrage bounds on a European price (Chapter 7). Black–Scholes reaches
 * the lower one as σ → 0 and the upper one as σ → ∞, so a price strictly
 * between them has exactly one implied volatility.
 */
export function priceBounds(type: OptionType, { S, K, T, r, q = 0 }: MarketInput): [number, number] {
  const fwdS = S * Math.exp(-q * T);
  const pvK = K * Math.exp(-r * T);
  return type === 'call' ? [Math.max(fwdS - pvK, 0), fwdS] : [Math.max(pvK - fwdS, 0), pvK];
}

/**
 * The Newton–Raphson iterates σ₀, σ₁, … for C(σ) = target, using vega as the
 * slope (Chapter 25). Stops when the step is tiny, after maxIter steps, or when
 * an iterate leaves (0, 5]: Newton can overshoot from a poor start.
 */
export function newtonIterates(type: OptionType, target: number, market: MarketInput, sigma0: number, maxIter = 12, tol = 1e-10): number[] {
  const xs = [sigma0];
  let s = sigma0;
  for (let i = 0; i < maxIter; i++) {
    const input = { ...market, sigma: s };
    const vega = greeks(type, input).vega;
    if (!(vega > 1e-14)) break;
    const next = s - (price(type, input) - target) / vega;
    xs.push(next);
    if (!(next > 0 && next <= 5)) break;
    if (Math.abs(next - s) < tol) break;
    s = next;
  }
  return xs;
}

/**
 * A starting point from which Newton converges monotonically for Black–Scholes
 * (Manaster and Koehler, 1982): the volatility at which vega is largest.
 */
export function manasterKoehlerGuess({ S, K, T, r, q = 0 }: MarketInput): number {
  return Math.sqrt((2 * Math.abs(Math.log(S / K) + (r - q) * T)) / T) || 0.2;
}

export interface ImpliedVolResult {
  sigma: number;
  method: 'newton' | 'bisection';
  iterations: number;
}

/**
 * Implied volatility of a European option: Newton from the Manaster–Koehler
 * guess, falling back to bisection on [1e-6, 5] if Newton misbehaves.
 * Returns NaN when the price is outside the no-arbitrage bounds.
 */
export function impliedVol(type: OptionType, target: number, market: MarketInput, tol = 1e-10): ImpliedVolResult {
  const [lo, hi] = priceBounds(type, market);
  if (!(target > lo && target < hi)) return { sigma: NaN, method: 'bisection', iterations: 0 };
  const xs = newtonIterates(type, target, market, manasterKoehlerGuess(market), 50, tol);
  const last = xs[xs.length - 1];
  if (last > 0 && last <= 5 && Math.abs(price(type, { ...market, sigma: last }) - target) < 1e-8 * Math.max(1, target)) {
    return { sigma: last, method: 'newton', iterations: xs.length - 1 };
  }
  let iterations = 0;
  const f = (s: number) => {
    iterations++;
    return price(type, { ...market, sigma: s }) - target;
  };
  return { sigma: bisection(f, 1e-6, 5, { tol }), method: 'bisection', iterations };
}

/** Bisection iterates for the same equation, as [lo, hi] brackets (for comparison with Newton). */
export function bisectionBrackets(type: OptionType, target: number, market: MarketInput, lo = 0.01, hi = 1, steps = 12): [number, number][] {
  const f = (s: number) => price(type, { ...market, sigma: s }) - target;
  const out: [number, number][] = [[lo, hi]];
  let a = lo, b = hi, fa = f(a);
  for (let i = 0; i < steps; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fa * fm <= 0) b = m;
    else { a = m; fa = fm; }
    out.push([a, b]);
  }
  return out;
}

/**
 * Historical (realised) volatility: the sample standard deviation of log
 * returns, annualised with √(periods per year).
 */
export function historicalVol(prices: number[], periodsPerYear = 252): number {
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) rets.push(Math.log(prices[i] / prices[i - 1]));
  const n = rets.length;
  if (n < 2) return NaN;
  const mean = rets.reduce((a, b) => a + b, 0) / n;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance * periodsPerYear);
}

/** Approximate standard error of a historical-vol estimate from n returns: σ/√(2n). */
export const historicalVolStdError = (sigma: number, n: number) => sigma / Math.sqrt(2 * n);

/** Historical volatility over a trailing window of `window` returns, at every date where it's defined (NaN before). */
export function rollingVol(prices: number[], window: number, periodsPerYear = 252): number[] {
  return prices.map((_, i) => (i < window ? NaN : historicalVol(prices.slice(i - window, i + 1), periodsPerYear)));
}

/**
 * Brenner and Subrahmanyam's (1988) rule of thumb for an option struck at the
 * forward: C ≈ 0.4·S·σ√T, so σ ≈ √(2π/T)·C/S.
 */
export const brennerSubrahmanyam = (C: number, S: number, T: number) => Math.sqrt((2 * Math.PI) / T) * (C / S);
