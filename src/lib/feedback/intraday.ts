import { cdf, pdf } from '../math/normal';

/**
 * Zero-days-to-expiry options and intraday dynamics (Chapter 68). Time is
 * measured as the fraction u ∈ [0, 1] of a 6.5-hour trading day. Volatility is
 * not spread evenly over the day: variance arrives faster at the open and the
 * close. An option's value depends on the variance still to come,
 * V(u) = σ²/252 ∫_u^1 w(x) dx, where w averages to 1 over the day.
 */

export const DAY_HOURS = 6.5;
export const TRADING_DAYS = 252;

const rawWeight = (u: number) => 1 + 3 * Math.exp(-u / 0.06) + 1.2 * Math.exp(-(1 - u) / 0.08);
const GRID = 2000;
const NORM = (() => {
  let s = 0;
  for (let i = 0; i < GRID; i++) s += rawWeight((i + 0.5) / GRID);
  return s / GRID;
})();

/** Instantaneous variance relative to the day's average (U-shaped, mean 1 over the day). */
export const varianceWeight = (u: number, seasonal = true) => (seasonal ? rawWeight(u) / NORM : 1);

/** Share of the day's variance still to come after u: ∫_u^1 w(x) dx. */
export function remainingShare(u: number, seasonal = true): number {
  const a = Math.min(Math.max(u, 0), 1);
  if (!seasonal) return 1 - a;
  const n = 400, h = (1 - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += varianceWeight(a + (i + 0.5) * h);
  return s * h;
}

export interface ZeroDte {
  value: number;
  delta: number;
  /** Per share per $1. */
  gamma: number;
  /** Dollars per share lost per hour if the stock doesn't move (positive number). */
  thetaPerHour: number;
  /** Remaining variance V, in year units of σ². */
  variance: number;
}

/**
 * A call expiring at today's close, priced with the variance still to come
 * (zero rates): Black–Scholes with σ²τ replaced by V.
 */
export function zeroDteCall(S: number, K: number, sigma: number, u: number, seasonal = true): ZeroDte {
  const V = ((sigma * sigma) / TRADING_DAYS) * remainingShare(u, seasonal);
  if (V <= 1e-14) return { value: Math.max(S - K, 0), delta: S > K ? 1 : 0, gamma: 0, thetaPerHour: 0, variance: 0 };
  const s = Math.sqrt(V);
  const d1 = (Math.log(S / K) + V / 2) / s, d2 = d1 - s;
  const value = S * cdf(d1) - K * cdf(d2);
  const gamma = pdf(d1) / (S * s);
  // dValue/dV = S φ(d1) / (2√V); variance runs off at σ²/252 · w(u) per day, i.e. per DAY_HOURS hours.
  const dVdHour = ((sigma * sigma) / TRADING_DAYS) * varianceWeight(u, seasonal) / DAY_HOURS;
  return { value, delta: cdf(d1), gamma, thetaPerHour: ((S * pdf(d1)) / (2 * s)) * dVdHour, variance: V };
}

/* ------------------------------------------------------------------------- */
/* Event variance                                                             */
/* ------------------------------------------------------------------------- */

/**
 * Variance of a one-off event (an earnings release) that falls between two
 * expiries T₁ < T₂ (years): total variance at T₂ minus total variance at T₁,
 * minus the normal-day variance in between:
 *   σ²_event = σ²_{T₂} T₂ − σ²_{T₁} T₁ − σ²_base (T₂ − T₁).
 */
export function eventVariance(iv1: number, T1: number, iv2: number, T2: number, base: number): number {
  return iv2 * iv2 * T2 - iv1 * iv1 * T1 - base * base * (T2 - T1);
}

/** Implied volatility at expiry T for normal-day volatility `base` plus an event of variance v at time tEvent. */
export function ivWithEvent(T: number, base: number, v: number, tEvent: number): number {
  return Math.sqrt((base * base * T + (T > tEvent ? v : 0)) / T);
}

/** The event's implied move: one standard deviation, and the expected absolute move √(2/π)·sd for a normal jump. */
export function impliedMove(v: number): { sd: number; expectedAbs: number } {
  const sd = Math.sqrt(Math.max(v, 0));
  return { sd, expectedAbs: Math.sqrt(2 / Math.PI) * sd };
}
