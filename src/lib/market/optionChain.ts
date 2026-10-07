import { mulberry32 } from '../math/rng';
import { price, type BSInput } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';

/** One side of the chain at one strike. Prices are per share. */
export interface Quote {
  bid: number;
  ask: number;
  /** Black–Scholes value the quotes are built around. */
  theo: number;
  volume: number;
  openInterest: number;
  inTheMoney: boolean;
}

export interface ChainRow {
  strike: number;
  call: Quote;
  put: Quote;
}

export interface ChainInput extends Omit<BSInput, 'K'> {
  strikes: number[];
  seed?: number;
}

/** Standard US listed-option tick sizes: $0.05 below $3, $0.10 at or above. */
export function tickSize(p: number): number {
  return p < 3 ? 0.05 : 0.1;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const floorTo = (x: number, tick: number) => round2(Math.floor(x / tick + 1e-9) * tick);
const ceilTo = (x: number, tick: number) => round2(Math.ceil(x / tick - 1e-9) * tick);

/**
 * Bid and ask around a theoretical value: a half-spread of 2% of the value,
 * at least one tick, rounded outwards to the tick grid. Never a negative bid.
 */
export function quoteAround(theo: number): { bid: number; ask: number } {
  const half = Math.max(0.02 * theo, tickSize(theo));
  const bid = Math.max(floorTo(theo - half, tickSize(theo - half)), 0);
  const ask = Math.max(ceilTo(theo + half, tickSize(theo + half)), bid + tickSize(theo));
  return { bid, ask: round2(ask) };
}

/**
 * A synthetic but realistic option chain: prices from Black–Scholes (flat
 * volatility, so no smile yet — that's Part VI), quotes on the tick grid, and
 * seeded volume and open interest that cluster near the money and at round strikes.
 */
export function optionChain({ strikes, seed = 1, ...market }: ChainInput): ChainRow[] {
  const rand = mulberry32(seed);
  const activity = (strike: number) => {
    const distance = (strike - market.S) / (0.12 * market.S);
    const roundStrike = strike % 10 === 0 ? 1.6 : 1;
    const shortDated = 1 / Math.sqrt(Math.max(market.T, 1 / 52));
    return 900 * Math.exp(-distance * distance) * roundStrike * (0.6 + 0.8 * rand()) * Math.min(shortDated, 3) + 40 * rand();
  };
  const side = (type: OptionType, strike: number): Quote => {
    const theo = price(type, { ...market, K: strike });
    const { bid, ask } = quoteAround(theo);
    const openInterest = Math.round(activity(strike) * 6);
    const volume = Math.round(openInterest * (0.05 + 0.3 * rand()));
    const inTheMoney = type === 'call' ? market.S > strike : market.S < strike;
    return { bid, ask, theo, volume, openInterest, inTheMoney };
  };
  return strikes.map((strike) => ({ strike, call: side('call', strike), put: side('put', strike) }));
}
