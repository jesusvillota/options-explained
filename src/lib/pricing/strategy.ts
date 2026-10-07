import { DEFAULTS, price } from './blackScholes';
import { payoff, type Side } from './payoff';

/**
 * Multi-leg positions at expiry (Chapter 5). Every payoff here is piecewise
 * linear in S_T with kinks only at the strikes, so everything (breakevens,
 * best and worst cases) can be computed exactly from the kinks and slopes.
 */
export type LegKind = 'call' | 'put' | 'stock';

export interface StrategyLeg {
  kind: LegKind;
  side: Side;
  /** Number of units (options or shares). */
  quantity: number;
  /** Strike, for options. Ignored for stock. */
  strike: number;
  /** Price per unit paid (long) or received (short) today. For stock, the share price. */
  premium: number;
}

const sign = (side: Side) => (side === 'long' ? 1 : -1);

/** Value at expiry of one unit of the leg's instrument (before the long/short sign). */
function unitValue(leg: StrategyLeg, s: number): number {
  return leg.kind === 'stock' ? s : payoff(leg.kind, s, leg.strike);
}

export function legPayoffAt(leg: StrategyLeg, s: number): number {
  return sign(leg.side) * leg.quantity * unitValue(leg, s);
}

export function legProfitAt(leg: StrategyLeg, s: number): number {
  return sign(leg.side) * leg.quantity * (unitValue(leg, s) - leg.premium);
}

export function strategyPayoff(legs: StrategyLeg[], s: number): number {
  return legs.reduce((sum, leg) => sum + legPayoffAt(leg, s), 0);
}

/** Net cash paid today: positive is a debit (you pay), negative a credit (you receive). */
export function netCost(legs: StrategyLeg[]): number {
  return legs.reduce((sum, leg) => sum + sign(leg.side) * leg.quantity * leg.premium, 0);
}

export function strategyProfit(legs: StrategyLeg[], s: number): number {
  return strategyPayoff(legs, s) - netCost(legs);
}

/** The strikes where the payoff can bend, sorted and without duplicates. */
export function kinks(legs: StrategyLeg[]): number[] {
  return [...new Set(legs.filter((l) => l.kind !== 'stock').map((l) => l.strike))].sort((a, b) => a - b);
}

/** Slope of the payoff for very large S_T: calls and stock count, puts are flat there. */
export function slopeAtInfinity(legs: StrategyLeg[]): number {
  return legs.reduce((sum, leg) => sum + (leg.kind === 'put' ? 0 : sign(leg.side) * leg.quantity), 0);
}

/** Stock prices at expiry where the profit is exactly zero (on segments where it isn't identically zero). */
export function breakevens(legs: StrategyLeg[]): number[] {
  const points = [0, ...kinks(legs).filter((k) => k > 0)];
  const out: number[] = [];
  const push = (x: number) => {
    if (!out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x);
  };
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const fa = strategyProfit(legs, a);
    const last = i === points.length - 1;
    const b = last ? a + 1 : points[i + 1];
    const fb = strategyProfit(legs, b);
    const slope = (fb - fa) / (b - a);
    if (Math.abs(slope) < 1e-12) continue; // flat segment: either never zero or zero everywhere
    const root = a - fa / slope;
    if (root >= a - 1e-9 && (last || root <= b + 1e-9) && root >= 0) push(root);
  }
  return out.sort((x, y) => x - y);
}

export interface ProfitRange {
  /** Best profit at expiry; Infinity if unlimited. */
  maxProfit: number;
  /** Worst profit at expiry (a negative number for a loss); -Infinity if unlimited. */
  minProfit: number;
}

/** Best and worst profit at expiry, over all S_T ≥ 0. */
export function profitRange(legs: StrategyLeg[]): ProfitRange {
  const candidates = [0, ...kinks(legs)].map((s) => strategyProfit(legs, s));
  const tail = slopeAtInfinity(legs);
  return {
    maxProfit: tail > 1e-12 ? Infinity : Math.max(...candidates),
    minProfit: tail < -1e-12 ? -Infinity : Math.min(...candidates),
  };
}

/** A leg priced in the course's default market (S = 100, r = 5%, σ = 20%, T = 1). */
export function makeLeg(kind: LegKind, side: Side, strike = DEFAULTS.K, quantity = 1): StrategyLeg {
  const premium = kind === 'stock' ? DEFAULTS.S : price(kind, { ...DEFAULTS, K: strike });
  return { kind, side, quantity, strike, premium };
}

export interface Preset {
  name: string;
  /** What the position is a bet on. */
  view: string;
  legs: () => StrategyLeg[];
}

export const PRESETS: Record<string, Preset> = {
  'long-call': { name: 'Long call', view: 'The stock will rise.', legs: () => [makeLeg('call', 'long', 100)] },
  'long-put': { name: 'Long put', view: 'The stock will fall.', legs: () => [makeLeg('put', 'long', 100)] },
  'bull-call-spread': {
    name: 'Bull call spread',
    view: 'A moderate rise. You give up gains above the upper strike to make the bet cheaper.',
    legs: () => [makeLeg('call', 'long', 100), makeLeg('call', 'short', 115)],
  },
  'bear-put-spread': {
    name: 'Bear put spread',
    view: 'A moderate fall, more cheaply than a put on its own.',
    legs: () => [makeLeg('put', 'long', 100), makeLeg('put', 'short', 85)],
  },
  'long-straddle': {
    name: 'Long straddle',
    view: 'A big move, in either direction.',
    legs: () => [makeLeg('call', 'long', 100), makeLeg('put', 'long', 100)],
  },
  'short-straddle': {
    name: 'Short straddle',
    view: 'The stock stays put. Small, capped gain; large losses on a big move either way.',
    legs: () => [makeLeg('call', 'short', 100), makeLeg('put', 'short', 100)],
  },
  'long-strangle': {
    name: 'Long strangle',
    view: 'A very big move in either direction, more cheaply than a straddle.',
    legs: () => [makeLeg('call', 'long', 110), makeLeg('put', 'long', 90)],
  },
  'long-butterfly': {
    name: 'Long butterfly',
    view: 'The stock ends close to the middle strike. Cheap, with limited risk.',
    legs: () => [makeLeg('call', 'long', 90), makeLeg('call', 'short', 100, 2), makeLeg('call', 'long', 110)],
  },
  'iron-condor': {
    name: 'Iron condor',
    view: 'The stock stays inside a range. You collect premium, and losses are capped.',
    legs: () => [makeLeg('put', 'long', 80), makeLeg('put', 'short', 90), makeLeg('call', 'short', 110), makeLeg('call', 'long', 120)],
  },
  'covered-call': {
    name: 'Covered call',
    view: 'You own the stock and expect it to drift. You sell its upside above the strike for income.',
    legs: () => [makeLeg('stock', 'long'), makeLeg('call', 'short', 110)],
  },
  'protective-put': {
    name: 'Protective put',
    view: 'You own the stock and want insurance against a fall.',
    legs: () => [makeLeg('stock', 'long'), makeLeg('put', 'long', 95)],
  },
  collar: {
    name: 'Collar',
    view: 'You own the stock. You fund the insurance (a put) by selling the upside (a call).',
    legs: () => [makeLeg('stock', 'long'), makeLeg('put', 'long', 90), makeLeg('call', 'short', 110)],
  },
};
