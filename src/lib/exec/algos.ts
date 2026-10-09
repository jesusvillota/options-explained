import { cdf } from '../math/normal';
import { normalRng } from '../math/rng';

/**
 * Execution algorithms in practice (Chapter 64): schedules that track a
 * benchmark through a noisy trading day, the choice between a limit order and
 * a market order, and the decomposition of implementation shortfall.
 */

/** Five-minute bins in a 6.5-hour trading day. */
export const BINS = 78;

/**
 * The typical intraday volume curve: heavy at the open, a midday lull, and a
 * surge into the close. Fractions of the day's volume per bin, summing to 1.
 */
export function volumeCurve(bins = BINS): number[] {
  const w = Array.from({ length: bins }, (_, k) => {
    const t = (k + 0.5) / bins;
    return 1 + 2.5 * Math.exp(-t / 0.05) + 2 * Math.exp(-(1 - t) / 0.06);
  });
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / total);
}

export interface DayOptions {
  /** Log standard deviation of the day's total volume. */
  dayNoise?: number;
  /** Log standard deviation of each bin's volume around the curve. */
  binNoise: number;
  /** Price volatility per bin, in basis points. */
  sigmaBin?: number;
}

/**
 * One simulated day: volume per bin (as a fraction of an average day's volume)
 * and the average price in each bin (basis points relative to the open).
 */
export function simulateDay(seed: number, o: DayOptions): { volume: number[]; price: number[] } {
  const { dayNoise = 0.25, binNoise, sigmaBin = 200 / Math.sqrt(BINS) } = o;
  const z = normalRng(seed), curve = volumeCurve();
  const day = Math.exp(dayNoise * z() - dayNoise ** 2 / 2);
  const volume = curve.map((c) => c * day * Math.exp(binNoise * z() - binNoise ** 2 / 2));
  let p = 0;
  const price = curve.map(() => {
    const start = p;
    p += sigmaBin * z();
    return (start + p) / 2;
  });
  return { volume, price };
}

export type Algo = 'twap' | 'vwap' | 'pov';

/**
 * Shares (as a fraction of an average day's volume) bought in each bin to buy X.
 * TWAP: equal slices. VWAP: slices from the historical curve. POV: a fixed share
 * X of the volume actually traded, buying any remainder in the last bin.
 */
export function algoSchedule(algo: Algo, X: number, volume: number[]): number[] {
  const n = volume.length, curve = volumeCurve(n);
  if (algo === 'twap') return new Array(n).fill(X / n);
  if (algo === 'vwap') return curve.map((c) => X * c);
  let left = X;
  return volume.map((v, k) => {
    const q = k === n - 1 ? left : Math.min(left, X * v);
    left -= q;
    return q;
  });
}

/** Average price paid against the market's VWAP, in basis points (positive = paid more). */
export function slippageVsVwap(trades: number[], price: number[], volume: number[]): number {
  const vol = volume.reduce((a, b) => a + b, 0), X = trades.reduce((a, b) => a + b, 0);
  const vwap = price.reduce((a, p, k) => a + p * volume[k], 0) / vol;
  const paid = price.reduce((a, p, k) => a + p * trades[k], 0) / X;
  return paid - vwap;
}

/** Slippage against VWAP over many simulated days: mean, standard deviation and the share of days with a final catch-up. */
export function trackingStudy(algo: Algo, X: number, days: number, seed: number, o: DayOptions): { mean: number; sd: number; catchUp: number } {
  const s: number[] = [];
  let catchUp = 0;
  for (let d = 0; d < days; d++) {
    const { volume, price } = simulateDay(seed + 7 * d, o);
    const trades = algoSchedule(algo, X, volume);
    if (algo === 'pov' && trades[trades.length - 1] > 2 * X * volume[volume.length - 1]) catchUp++;
    s.push(slippageVsVwap(trades, price, volume));
  }
  const mean = s.reduce((a, b) => a + b, 0) / days;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (days - 1));
  return { mean, sd, catchUp: catchUp / days };
}

/* ------------------------------------------------------------------------- */
/* Limit order or market order?                                               */
/* ------------------------------------------------------------------------- */

/**
 * Probability that the mid, X_t = μt + σW_t, falls to −δ within time h
 * (first passage of Brownian motion with drift):
 *   Φ((−δ − μh)/(σ√h)) + e^{−2μδ/σ²} Φ((−δ + μh)/(σ√h)).
 */
export function hitProbability(delta: number, mu: number, sigma: number, h: number): number {
  if (h <= 0) return delta <= 0 ? 1 : 0;
  const s = sigma * Math.sqrt(h);
  const reflected = Math.exp((-2 * mu * delta) / sigma ** 2);
  return cdf((-delta - mu * h) / s) + (Number.isFinite(reflected) ? reflected * cdf((-delta + mu * h) / s) : 0);
}

/** Expected time until the fill or the deadline, E[τ ∧ h] = ∫₀ʰ P(τ > t) dt. */
export function expectedWait(delta: number, mu: number, sigma: number, h: number, n = 400): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += 1 - hitProbability(delta, mu, sigma, ((i + 0.5) * h) / n);
  return (s * h) / n;
}

/**
 * Expected cost, against the arrival mid, of posting a buy limit order δ below
 * the mid and buying at the ask (half-spread s/2 above the mid) if it isn't
 * filled by time h. Optional stopping gives
 *   E[cost] = (1 − P) s/2 + μ E[τ ∧ h].
 */
export function limitOrderCost(delta: number, spread: number, mu: number, sigma: number, h: number): { fill: number; cost: number; wait: number } {
  const fill = hitProbability(delta, mu, sigma, h), wait = expectedWait(delta, mu, sigma, h);
  return { fill, wait, cost: (1 - fill) * (spread / 2) + mu * wait };
}

/** Monte Carlo check of the limit-order strategy's cost (for tests). */
export function simulateLimitOrder(delta: number, spread: number, mu: number, sigma: number, h: number, paths: number, seed: number, steps = 2000): number {
  const z = normalRng(seed), dt = h / steps;
  let total = 0;
  for (let i = 0; i < paths; i++) {
    let x = 0, filled = false;
    for (let k = 0; k < steps; k++) {
      x += mu * dt + sigma * Math.sqrt(dt) * z();
      if (x <= -delta) {
        filled = true;
        break;
      }
    }
    total += filled ? -delta : x + spread / 2;
  }
  return total / paths;
}

/* ------------------------------------------------------------------------- */
/* Measuring implementation shortfall                                         */
/* ------------------------------------------------------------------------- */

/**
 * Perold's decomposition of a buy order's implementation shortfall, in dollars:
 * delay (the price moved between the decision and the first order), execution
 * (fills against the arrival price) and opportunity (the unfilled part, marked
 * at the close).
 */
export function shortfall(o: { target: number; decision: number; arrival: number; fills: { qty: number; price: number }[]; close: number }) {
  const filled = o.fills.reduce((a, f) => a + f.qty, 0);
  const delay = filled * (o.arrival - o.decision);
  const execution = o.fills.reduce((a, f) => a + f.qty * (f.price - o.arrival), 0);
  const opportunity = (o.target - filled) * (o.close - o.decision);
  return { delay, execution, opportunity, total: delay + execution + opportunity, filled };
}
