import { normalRng, mulberry32 } from '../math/rng';
import { DEFAULTS, greeks, price } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';
import { EQUITY_SSVI, ssviVol } from '../vol/smile';

/**
 * Measuring liquidity (Chapter 47): spread measures from trades, Roll's
 * estimator, and spreads across an option chain in dollars, percent and
 * volatility points.
 */

export interface TradeTape {
  /** Efficient (mid) price just before each trade. */
  mid: number[];
  /** Trade price. */
  price: number[];
  /** Trade sign: +1 buyer-initiated, −1 seller-initiated. */
  sign: number[];
}

export interface StructuralParams {
  n: number;
  /** Half-spread: trades happen at m ± h. */
  h: number;
  /** Permanent impact of each trade on the efficient price (adverse selection). */
  lambda: number;
  /** Standard deviation of public news between trades. */
  sigmaU: number;
  m0: number;
  seed: number;
}

/**
 * The simplest structural model of trades (Glosten–Harris, Huang–Stoll): the
 * efficient price moves with public news and with the information in each trade,
 *   m_{t+1} = m_t + λ d_t + u_{t+1},
 * and trades happen at p_t = m_t + h d_t, with independent, equally likely signs.
 * The mid array has n + 1 entries (the last one after the final trade).
 */
export function simulateTrades({ n, h, lambda, sigmaU, m0, seed }: StructuralParams): TradeTape {
  const u = normalRng(seed);
  const coin = mulberry32(seed + 1);
  const mid = [m0], priceOut: number[] = [], sign: number[] = [];
  for (let t = 0; t < n; t++) {
    const d = coin() < 0.5 ? 1 : -1;
    sign.push(d);
    priceOut.push(mid[t] + h * d);
    mid.push(mid[t] + lambda * d + sigmaU * u());
  }
  return { mid, price: priceOut, sign };
}

export interface SpreadDecomposition {
  /** Average d_t (p_t − M_t). */
  effective: number;
  /** Average d_t (p_t − M_{t+k}): what the liquidity provider keeps. */
  realised: number;
  /** Average d_t (M_{t+k} − M_t): what it loses to the price moving against it. */
  impact: number;
}

/** Effective, realised and impact half-spreads, measured k trades later. */
export function decompose(tape: TradeTape, k: number): SpreadDecomposition {
  let e = 0, r = 0, i = 0, n = 0;
  for (let t = 0; t + k < tape.mid.length && t < tape.price.length; t++) {
    const d = tape.sign[t];
    e += d * (tape.price[t] - tape.mid[t]);
    r += d * (tape.price[t] - tape.mid[t + k]);
    i += d * (tape.mid[t + k] - tape.mid[t]);
    n++;
  }
  return { effective: e / n, realised: r / n, impact: i / n };
}

/** Sample autocovariance of consecutive price changes. */
export function firstAutocovariance(prices: number[]): number {
  const dp = prices.slice(1).map((p, i) => p - prices[i]);
  const mean = dp.reduce((a, b) => a + b, 0) / dp.length;
  let c = 0;
  for (let t = 1; t < dp.length; t++) c += (dp[t] - mean) * (dp[t - 1] - mean);
  return c / (dp.length - 1);
}

/**
 * Roll's (1984) estimator of the quoted spread from trade prices alone:
 * s = 2√(−Cov(Δp_t, Δp_{t−1})). Undefined (NaN) if the autocovariance is positive.
 */
export function rollSpread(prices: number[]): number {
  const c = firstAutocovariance(prices);
  return c < 0 ? 2 * Math.sqrt(-c) : NaN;
}

// ---------------------------------------------------------------------------
// Spreads across a chain

export type TickRule = 'standard' | 'penny';

/** US-style tick sizes: $0.05 below $3 and $0.10 above, or a penny below $3 and $0.05 above. */
export function tickFor(p: number, rule: TickRule): number {
  if (rule === 'penny') return p < 3 ? 0.01 : 0.05;
  return p < 3 ? 0.05 : 0.1;
}

export interface QuoteModel {
  /** Fixed half-spread for handling the order, $ per share. */
  base: number;
  /** Edge in volatility points per unit of vega (a risk charge). */
  volEdge: number;
  /** Cost of hedging delta: the stock's half-spread, $ per share. */
  stockHalfSpread: number;
}

export const DEFAULT_QUOTE_MODEL: QuoteModel = { base: 0.01, volEdge: 0.4, stockHalfSpread: 0.01 };

export interface ChainLiquidityRow {
  strike: number;
  type: OptionType;
  bid: number;
  ask: number;
  theo: number;
  vol: number;
  /** Vega per volatility point. */
  vegaPt: number;
  spread: number;
  /** Spread as a fraction of the mid (2 = 200% when the bid is zero). */
  spreadPct: number;
  /** Spread in volatility points: (a − b) / vega per point. */
  spreadVol: number;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export interface OptionQuote {
  type: OptionType;
  strike: number;
  bid: number;
  ask: number;
  theo: number;
  vol: number;
  delta: number;
  /** Vega per volatility point. */
  vegaPt: number;
}

/**
 * Quote one option on the skewed smile with time to expiry T: theo ± a
 * half-spread that pays for handling, for vega risk and for hedging delta,
 * rounded outwards to the tick grid.
 */
export function quoteOption(type: OptionType, K: number, T: number, rule: TickRule = 'standard', model: QuoteModel = DEFAULT_QUOTE_MODEL, S: number = DEFAULTS.S): OptionQuote {
  const { r } = DEFAULTS;
  const F = DEFAULTS.S * Math.exp(r * T);
  const vol = ssviVol(Math.log(K / F), T, EQUITY_SSVI);
  const input = { ...DEFAULTS, S, T, K, sigma: vol };
  const theo = price(type, input);
  const g = greeks(type, input);
  const vegaPt = g.vega * 0.01;
  const half = model.base + model.volEdge * vegaPt + Math.abs(g.delta) * model.stockHalfSpread;
  const tb = tickFor(Math.max(theo - half, 0), rule), ta = tickFor(theo + half, rule);
  const bid = Math.max(round2(Math.floor((theo - half) / tb + 1e-9) * tb), 0);
  const ask = Math.max(round2(Math.ceil((theo + half) / ta - 1e-9) * ta), round2(bid + tickFor(bid, rule)));
  return { type, strike: K, bid, ask, theo, vol, delta: g.delta, vegaPt };
}

/**
 * Quotes for out-of-the-money options (puts below the forward, calls above) on a
 * skewed smile. Far from the money the tick floor dominates.
 */
export function chainLiquidity(T: number, strikes: number[], rule: TickRule = 'standard', model: QuoteModel = DEFAULT_QUOTE_MODEL): ChainLiquidityRow[] {
  const F = DEFAULTS.S * Math.exp(DEFAULTS.r * T);
  return strikes.map((K) => {
    const q = quoteOption(K < F ? 'put' : 'call', K, T, rule, model);
    const spread = round2(q.ask - q.bid);
    const mid = (q.bid + q.ask) / 2;
    return { strike: K, type: q.type, bid: q.bid, ask: q.ask, theo: q.theo, vol: q.vol, vegaPt: q.vegaPt, spread, spreadPct: spread / mid, spreadVol: spread / q.vegaPt };
  });
}
