import { optionChain, type ChainRow } from '../market/optionChain';
import { DEFAULTS, greeks, type BSInput } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';

/**
 * Complex orders (Chapter 45): a strategy traded as one package. Its market can
 * be built from the legs' quotes, or quoted directly by a market maker who
 * prices the package's net risk.
 */

export interface PackageLeg {
  type: OptionType;
  strike: number;
  /** Signed quantity per package: +1 bought, −2 sold twice, ... */
  qty: number;
}

export interface LegQuote extends PackageLeg {
  bid: number;
  ask: number;
  theo: number;
  delta: number;
  /** Vega per volatility point (∂V/∂σ × 0.01). */
  vegaPt: number;
}

/** The 3-month chain of Chapters 4 and 43 (same seed), as quoted on the exchanges. */
export const PACKAGE_MARKET: Omit<BSInput, 'K'> = { ...DEFAULTS, T: 0.25 };
export const PACKAGE_STRIKES = [80, 85, 90, 95, 100, 105, 110, 115, 120];

export function threeMonthChain(): ChainRow[] {
  return optionChain({ ...PACKAGE_MARKET, strikes: PACKAGE_STRIKES, seed: 7 });
}

/** Attach the chain's quotes and Black–Scholes Greeks to each leg. */
export function quoteLegs(legs: PackageLeg[], chain: ChainRow[] = threeMonthChain()): LegQuote[] {
  return legs.map((leg) => {
    const row = chain.find((r) => r.strike === leg.strike);
    if (!row) throw new Error(`no strike ${leg.strike} in the chain`);
    const q = row[leg.type];
    const g = greeks(leg.type, { ...PACKAGE_MARKET, K: leg.strike });
    return { ...leg, bid: q.bid, ask: q.ask, theo: q.theo, delta: g.delta, vegaPt: g.vega * 0.01 };
  });
}

export interface PackageMarket {
  /** Selling the package: sell the long legs at their bids, buy back the short legs at their asks. */
  bid: number;
  /** Buying the package: buy the long legs at their asks, sell the short legs at their bids. */
  ask: number;
  theo: number;
  delta: number;
  vegaPt: number;
}

/** The package's market implied by trading each leg separately at its quote. */
export function impliedFromLegs(legs: LegQuote[]): PackageMarket {
  let bid = 0, ask = 0, theo = 0, delta = 0, vegaPt = 0;
  for (const l of legs) {
    bid += l.qty > 0 ? l.qty * l.bid : l.qty * l.ask;
    ask += l.qty > 0 ? l.qty * l.ask : l.qty * l.bid;
    theo += l.qty * l.theo;
    delta += l.qty * l.delta;
    vegaPt += l.qty * l.vegaPt;
  }
  return { bid, ask, theo, delta, vegaPt };
}

export interface ComplexQuoteParams {
  /** Edge charged per volatility point of net vega (in vol points). */
  volEdge: number;
  /** Handling charge per leg, in dollars per share. */
  perLeg: number;
  /** Price grid for packages (complex orders often trade in pennies). */
  tick: number;
}

export const DEFAULT_COMPLEX: ComplexQuoteParams = { volEdge: 0.5, perLeg: 0.01, tick: 0.01 };

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * A market maker's quote for the whole package: theo ± a half-spread that pays
 * for the package's net volatility risk plus a small charge per leg, rounded
 * outwards to the package tick. Offsetting legs mean a small net vega and a tight
 * quote; legs that add up (a straddle) get little or no discount. The package can
 * always be traded leg by leg, so its market is never worse than the legs'.
 */
export function complexQuote(legs: LegQuote[], p: ComplexQuoteParams = DEFAULT_COMPLEX): PackageMarket & { half: number } {
  const m = impliedFromLegs(legs);
  const half = p.volEdge * Math.abs(m.vegaPt) + p.perLeg * legs.length;
  const bid = round2(Math.floor((m.theo - half) / p.tick + 1e-9) * p.tick);
  const ask = round2(Math.ceil((m.theo + half) / p.tick - 1e-9) * p.tick);
  return { ...m, bid: Math.max(bid, round2(m.bid)), ask: Math.min(ask, round2(m.ask)), half };
}

/** Trading minutes in a year (252 days × 6.5 hours). */
export const MINUTES_PER_YEAR = 252 * 390;

/**
 * Legging risk: after trading the first leg, the rest of the package is still
 * to do, and its delta is exposed to stock moves. Over a delay of `minutes`, the
 * standard deviation of the change in the remaining legs' value is about
 * |Δ_rest|·σ·S·√δt, per share of the package.
 */
export function leggingRiskSd(legs: LegQuote[], minutes: number, S = PACKAGE_MARKET.S, sigma = PACKAGE_MARKET.sigma): number {
  const deltaRest = legs.slice(1).reduce((a, l) => a + l.qty * l.delta, 0);
  return Math.abs(deltaRest) * sigma * S * Math.sqrt(minutes / MINUTES_PER_YEAR);
}

export const STRATEGIES: Record<string, { label: string; legs: PackageLeg[] }> = {
  bullCall: { label: 'Bull call spread 100/105', legs: [{ type: 'call', strike: 100, qty: 1 }, { type: 'call', strike: 105, qty: -1 }] },
  bearPut: { label: 'Bear put spread 100/95', legs: [{ type: 'put', strike: 100, qty: 1 }, { type: 'put', strike: 95, qty: -1 }] },
  butterfly: { label: 'Call butterfly 95/100/105', legs: [{ type: 'call', strike: 95, qty: 1 }, { type: 'call', strike: 100, qty: -2 }, { type: 'call', strike: 105, qty: 1 }] },
  riskReversal: { label: 'Risk reversal (105 call − 95 put)', legs: [{ type: 'call', strike: 105, qty: 1 }, { type: 'put', strike: 95, qty: -1 }] },
  straddle: { label: 'Straddle 100', legs: [{ type: 'call', strike: 100, qty: 1 }, { type: 'put', strike: 100, qty: 1 }] },
  strangle: { label: 'Strangle 95/105', legs: [{ type: 'put', strike: 95, qty: 1 }, { type: 'call', strike: 105, qty: 1 }] },
};
