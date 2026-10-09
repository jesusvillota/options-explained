import { greeks } from '../pricing/blackScholes';
import { normalRng } from '../math/rng';

/**
 * Dealer gamma and hedging feedback (Chapter 66). Dealers who hold option
 * positions delta-hedge them. After the stock moves by δS, their delta has
 * changed by Γ_D δS, so they trade −Γ_D δS shares. With linear impact λ
 * (dollars per share), that trade moves the price too:
 *   δS = δF − λ Γ_D δS   ⇒   δS = δF / (1 + λ Γ_D),
 * where δF is the move the stock would have made without dealers. Long dealer
 * gamma damps moves; short dealer gamma amplifies them.
 */

export const FEEDBACK_STRIKES = [80, 85, 90, 95, 100, 105, 110, 115, 120];
export const FEEDBACK_MARKET = { S0: 100, sigma: 0.2, r: 0, tau0: 42 / 252 };
export const CONTRACT = 100;

/** Dealers' net positions per strike, in contracts (positive = dealers long). Puts below 100, calls from 100. */
export const POSITIONING: Record<string, { label: string; positions: number[] }> = {
  long: { label: 'Dealers long gamma', positions: [0, 0, 20000, 30000, 20000, 30000, 40000, 20000, 0] },
  short: { label: 'Dealers short gamma', positions: [0, -20000, -40000, -40000, -20000, -20000, -30000, 0, 0] },
  index: { label: 'Index-like: short puts, long calls', positions: [-20000, -30000, -40000, -30000, 20000, 40000, 40000, 30000, 10000] },
};

export const typeFor = (K: number) => (K < FEEDBACK_MARKET.S0 ? 'put' : 'call');

/** Dealers' aggregate gamma at spot S: shares their hedge changes by per $1 move. */
export function dealerGamma(S: number, tau: number, positions: number[], strikes = FEEDBACK_STRIKES, sigma = FEEDBACK_MARKET.sigma): number {
  if (tau <= 0) return 0;
  return strikes.reduce((sum, K, i) => (positions[i] === 0 ? sum : sum + positions[i] * CONTRACT * greeks(typeFor(K), { S, K, T: tau, r: 0, sigma }).gamma), 0);
}

/**
 * Gamma exposure ("GEX") per strike in dollars per 1% move: the dollar value of
 * stock dealers must trade if the stock moves 1%, Γ · S² · 1% per share.
 */
export function gexByStrike(S: number, tau: number, positions: number[], strikes = FEEDBACK_STRIKES, sigma = FEEDBACK_MARKET.sigma): number[] {
  return strikes.map((K, i) => positions[i] * CONTRACT * greeks(typeFor(K), { S, K, T: tau, r: 0, sigma }).gamma * S * S * 0.01);
}

/** The spot level where dealers' net gamma changes sign (the "gamma flip"), if any, in [lo, hi]. */
export function gammaFlip(tau: number, positions: number[], lo = 75, hi = 125): number | null {
  const n = 200;
  let prevS = lo, prev = dealerGamma(lo, tau, positions);
  for (let i = 1; i <= n; i++) {
    const S = lo + ((hi - lo) * i) / n, g = dealerGamma(S, tau, positions);
    if (prev === 0) return prevS;
    if (Math.sign(g) !== Math.sign(prev)) {
      let a = prevS, b = S;
      for (let k = 0; k < 50; k++) {
        const m = (a + b) / 2;
        if (Math.sign(dealerGamma(m, tau, positions)) === Math.sign(prev)) a = m;
        else b = m;
      }
      return (a + b) / 2;
    }
    prevS = S;
    prev = g;
  }
  return null;
}

/** The feedback multiplier 1/(1 + λΓ), with the denominator floored so the toy market stays stable. */
export const FLOOR = 0.25;
export const multiplier = (lambda: number, gamma: number) => 1 / Math.max(1 + lambda * gamma, FLOOR);

export interface FeedbackPath {
  /** Times in trading days. */
  t: number[];
  /** Stock without dealer hedging. */
  fundamental: number[];
  /** Stock with dealer hedging feeding back through impact. */
  price: number[];
  /** Dealers' gamma along the feedback path. */
  gamma: number[];
}

/**
 * Seeded paths with and without feedback, driven by the same shocks. Each step,
 * the stock without dealers returns σ√dt Z; with dealers the return is divided
 * by 1 + λΓ_D(S, τ), evaluated where the stock is now.
 */
export function simulateFeedback(o: { seed: number; lambda: number; positions: number[]; days?: number; stepsPerDay?: number }): FeedbackPath {
  const { seed, lambda, positions, days = 21, stepsPerDay = 13 } = o;
  const { S0, sigma, tau0 } = FEEDBACK_MARKET;
  const z = normalRng(seed), n = days * stepsPerDay, dt = 1 / (252 * stepsPerDay);
  const t = [0], fundamental = [S0], price = [S0], gamma = [dealerGamma(S0, tau0, positions)];
  let F = S0, S = S0;
  for (let k = 1; k <= n; k++) {
    const r = sigma * Math.sqrt(dt) * z();
    const g = dealerGamma(S, tau0 - (k - 1) * dt, positions);
    F *= 1 + r;
    S *= 1 + r * multiplier(lambda, g);
    t.push(k / stepsPerDay);
    fundamental.push(F);
    price.push(S);
    gamma.push(dealerGamma(S, tau0 - k * dt, positions));
  }
  return { t, fundamental, price, gamma };
}

/** Annualised realised volatility of a path sampled every dt years. */
export function realisedVol(path: number[], dt: number): number {
  let s = 0;
  for (let i = 1; i < path.length; i++) s += Math.log(path[i] / path[i - 1]) ** 2;
  return Math.sqrt(s / ((path.length - 1) * dt));
}
