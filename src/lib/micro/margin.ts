import { price, type BSInput } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';

/**
 * Margin for option positions (Chapter 46): a rule-based ("strategy-based")
 * requirement of the kind brokers apply to retail accounts, and a risk-based
 * requirement of the kind clearing houses compute: revalue the position under a
 * grid of price and volatility scenarios and charge the worst loss.
 */

export interface MarginLeg {
  type: OptionType;
  strike: number;
  /** Signed number of contracts: −1 written, +1 bought. */
  qty: number;
}

export type Market = Omit<BSInput, 'K'>;

export const MULTIPLIER = 100;

/** Value of the position in dollars (positive = an asset, negative = a liability). */
export function positionValue(legs: MarginLeg[], m: Market): number {
  return legs.reduce((a, l) => a + l.qty * MULTIPLIER * price(l.type, { ...m, K: l.strike }), 0);
}

const otmAmount = (l: MarginLeg, S: number) => (l.type === 'call' ? Math.max(l.strike - S, 0) : Math.max(S - l.strike, 0));

/**
 * Requirement for one written (naked) option, per share: the premium plus 20% of
 * the stock price less the out-of-the-money amount, with a floor of 10% of the
 * stock price (calls) or of the strike (puts). This is the classic rule for
 * naked equity options at US brokers; exact rules vary.
 */
export function nakedRequirementPerShare(l: MarginLeg, m: Market): number {
  const premium = price(l.type, { ...m, K: l.strike });
  const floor = l.type === 'call' ? 0.1 * m.S : 0.1 * l.strike;
  return premium + Math.max(0.2 * m.S - otmAmount(l, m.S), floor);
}

/**
 * Strategy-based margin, in dollars, for the positions used in Chapter 46:
 *  - long options only: nothing beyond paying for them;
 *  - one naked short option: the naked requirement;
 *  - a credit vertical (short one strike, long a further one, same type): the
 *    difference between the strikes, its maximum loss;
 *  - a short straddle or strangle (short a put and a call): the larger naked
 *    requirement plus the premium of the other side.
 */
export function strategyMargin(legs: MarginLeg[], m: Market): number {
  const shorts = legs.filter((l) => l.qty < 0);
  const longs = legs.filter((l) => l.qty > 0);
  if (shorts.length === 0) return 0;
  if (shorts.length === 1 && longs.length === 0) return -shorts[0].qty * MULTIPLIER * nakedRequirementPerShare(shorts[0], m);
  if (shorts.length === 1 && longs.length === 1 && shorts[0].type === longs[0].type && -shorts[0].qty === longs[0].qty) {
    const s = shorts[0], l = longs[0];
    const protective = s.type === 'put' ? l.strike < s.strike : l.strike > s.strike;
    if (!protective) return 0; // a debit spread: paid for in full
    return longs[0].qty * MULTIPLIER * Math.abs(s.strike - l.strike);
  }
  if (shorts.length === 2 && longs.length === 0 && shorts[0].type !== shorts[1].type && shorts[0].qty === shorts[1].qty) {
    const req = shorts.map((l) => nakedRequirementPerShare(l, m));
    const prem = shorts.map((l) => price(l.type, { ...m, K: l.strike }));
    const big = req[0] >= req[1] ? 0 : 1;
    return -shorts[0].qty * MULTIPLIER * (req[big] + prem[1 - big]);
  }
  throw new Error('strategyMargin: position type not covered');
}

export interface ScenarioGrid {
  /** Relative price moves, e.g. −0.09 … +0.09. */
  priceShocks: number[];
  /** Additive volatility shifts, e.g. −0.07 … +0.07. */
  volShocks: number[];
}

/**
 * A scenario grid scaled to the current volatility, as a clearing house's risk
 * model would: price moves up to a 99% two-week move, ±2.33·σ·√(10/252), and
 * volatility shifts up to a third of its level. Higher volatility means wider
 * scenarios and more margin: margin is procyclical.
 */
export function scaledGrid(sigma: number, nPrice = 11, nVol = 5): ScenarioGrid {
  const maxMove = 2.33 * sigma * Math.sqrt(10 / 252);
  const maxVol = sigma / 3;
  const lin = (n: number, a: number) => Array.from({ length: n }, (_, i) => -a + (2 * a * i) / (n - 1));
  return { priceShocks: lin(nPrice, maxMove), volShocks: lin(nVol, maxVol) };
}

/** P&L in dollars of the position in each scenario: rows are volatility shifts, columns price moves. */
export function riskArray(legs: MarginLeg[], m: Market, grid: ScenarioGrid): number[][] {
  const v0 = positionValue(legs, m);
  return grid.volShocks.map((dv) =>
    grid.priceShocks.map((dp) => positionValue(legs, { ...m, S: m.S * (1 + dp), sigma: Math.max(m.sigma + dv, 0.01) }) - v0),
  );
}

export interface ScenarioMargin {
  margin: number;
  worst: { priceShock: number; volShock: number; pnl: number };
  array: number[][];
}

/** Risk-based margin: the largest loss over the scenario grid (never negative). */
export function scenarioMargin(legs: MarginLeg[], m: Market, grid: ScenarioGrid = scaledGrid(m.sigma)): ScenarioMargin {
  const array = riskArray(legs, m, grid);
  let worst = { priceShock: 0, volShock: 0, pnl: Infinity };
  array.forEach((row, j) => row.forEach((pnl, i) => {
    if (pnl < worst.pnl) worst = { priceShock: grid.priceShocks[i], volShock: grid.volShocks[j], pnl };
  }));
  return { margin: Math.max(0, -worst.pnl), worst, array };
}

/**
 * Random assignment: N contracts of a series are short across all accounts, you
 * are short n of them, and k are exercised and assigned at random (each short
 * contract equally likely). Returns the probability that none of yours is
 * assigned, C(N − n, k)/C(N, k), and the expected number assigned, k·n/N.
 */
export function assignmentOdds(N: number, n: number, k: number): { pNone: number; expected: number } {
  let pNone = 1;
  for (let i = 0; i < k; i++) pNone *= Math.max(N - n - i, 0) / (N - i);
  return { pNone, expected: (k * n) / N };
}

export const MARGIN_POSITIONS: Record<string, { label: string; legs: MarginLeg[] }> = {
  shortPut: { label: 'Short 1 put, strike 95', legs: [{ type: 'put', strike: 95, qty: -1 }] },
  putSpread: { label: 'Short 95 / long 90 put spread', legs: [{ type: 'put', strike: 95, qty: -1 }, { type: 'put', strike: 90, qty: 1 }] },
  shortCall: { label: 'Short 1 call, strike 105', legs: [{ type: 'call', strike: 105, qty: -1 }] },
  shortStraddle: { label: 'Short straddle, strike 100', legs: [{ type: 'put', strike: 100, qty: -1 }, { type: 'call', strike: 100, qty: -1 }] },
  shortStrangle: { label: 'Short strangle 90 / 110', legs: [{ type: 'put', strike: 90, qty: -1 }, { type: 'call', strike: 110, qty: -1 }] },
};
