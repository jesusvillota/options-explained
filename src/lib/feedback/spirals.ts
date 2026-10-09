import { cdf, pdf } from '../math/normal';
import { normalRng } from '../math/rng';

/**
 * Liquidity spirals and volatility crashes (Chapter 69).
 *
 * If each dollar of price fall forces sales that cause a further fall of m
 * dollars, the total fall per dollar of initial shock is 1 + m + m² + … =
 * 1/(1 − m): the spiral multiplier.
 */
export const spiralMultiplier = (m: number) => (m < 1 ? 1 / (1 - m) : Infinity);

/**
 * A daily-rebalanced product with leverage L and assets A must trade
 * L(L − 1) r A of the underlying after a day's return r: positive (buy) after
 * a rise and negative (sell) after a fall, for leveraged (L > 1) and inverse
 * (L < 0) products alike.
 */
export const rebalanceTrade = (L: number, r: number, aum: number) => L * (L - 1) * r * aum;

/* ------------------------------------------------------------------------- */
/* Portfolio insurance                                                        */
/* ------------------------------------------------------------------------- */

export const CRASH = {
  S0: 100,
  /** Shares outstanding in the toy market. */
  shares: 100e6,
  /** Insurers protect against falls below this floor over three months. */
  floor: 90,
  tau: 0.25,
  sigma: 0.2,
  /** Normal price impact: dollars per share (1 million shares move the price 0.4%). */
  lambda: 4e-7,
  days: 10,
  stepsPerDay: 13,
  /** News on day 2: a 5% fall. */
  shockDay: 2,
  shock: -0.05,
};

/**
 * Shares a portfolio insurer holds to replicate stock plus a protective put
 * struck at the floor: the call's delta N(d₁) times the insured shares.
 */
export function insuredHolding(S: number, insured: number, tau = CRASH.tau): number {
  const s = CRASH.sigma * Math.sqrt(tau);
  const d1 = (Math.log(S / CRASH.floor) + 0.5 * s * s) / s;
  return insured * cdf(d1);
}

/** Shares the insurers sell per $1 fall: insured × call gamma at the floor. */
export function insurerGamma(S: number, insured: number, tau = CRASH.tau): number {
  const s = CRASH.sigma * Math.sqrt(tau);
  const d1 = (Math.log(S / CRASH.floor) + 0.5 * s * s) / s;
  return (insured * pdf(d1)) / (S * s);
}

export interface CrashOptions {
  seed: number;
  /** Share of all shares held by portfolio insurers. */
  insuredShare: number;
  /** How strongly liquidity providers pull back as volatility rises (0 = never). */
  withdrawal: number;
}

export interface CrashPath {
  t: number[];
  price: number[];
  /** Impact λ in force at each step. */
  lambda: number[];
  /** Cumulative shares sold by insurers. */
  sold: number[];
}

/**
 * One seeded path. Each half hour the stock moves with its own noise (and the
 * news shock); insurers then rebalance to N(d₁) of their shares, one step late,
 * and their trade moves the price by λ per share. Liquidity providers widen
 * impact as recent moves grow: λ_t = λ₀ (1 + κ · max(0, recent vol / normal − 1)).
 */
export function simulateCrash(o: CrashOptions): CrashPath {
  const c = CRASH, n = c.days * c.stepsPerDay, dt = 1 / (252 * c.stepsPerDay);
  const z = normalRng(o.seed);
  const insured = o.insuredShare * c.shares;
  const normalMove = c.sigma * Math.sqrt(dt);
  const t = [0], price = [c.S0], lambda = [c.lambda], sold = [0];
  let S = c.S0, held = insuredHolding(S, insured), soldSoFar = 0, recent = normalMove ** 2;
  for (let k = 1; k <= n; k++) {
    const tau = c.tau - k * dt;
    const news = k === c.shockDay * c.stepsPerDay ? c.shock : 0;
    const prev = S;
    S *= 1 + normalMove * z() + news;
    // Insurers react to the move just seen; liquidity providers have already seen it too.
    const r = S / prev - 1;
    recent = 0.8 * recent + 0.2 * r * r;
    const lam = c.lambda * (1 + o.withdrawal * Math.max(0, Math.sqrt(recent) / normalMove - 1));
    const target = insuredHolding(S, insured, tau);
    const trade = target - held;
    held = target;
    S = Math.max(S + lam * trade, 1);
    soldSoFar -= Math.min(trade, 0);
    t.push(k / c.stepsPerDay);
    price.push(S);
    lambda.push(lam);
    sold.push(soldSoFar);
  }
  return { t, price, lambda, sold };
}

/** Largest peak-to-trough fall of a path, as a fraction. */
export function maxDrawdown(path: number[]): number {
  let peak = path[0], dd = 0;
  for (const p of path) {
    peak = Math.max(peak, p);
    dd = Math.max(dd, 1 - p / peak);
  }
  return dd;
}
