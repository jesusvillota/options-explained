import { DEFAULTS, price } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';
import { quoteOption } from '../micro/liquidity';
import { EQUITY_SSVI, ssviVol } from '../vol/smile';

/**
 * Where should an informed trader trade (Chapter 53)? Someone who knows the
 * stock will move from S to S(1 + J) overnight can buy the stock at its ask, or
 * an option at its ask, and mark the position at fair value the next day.
 */

export interface VenueResult {
  label: string;
  type: OptionType | 'stock';
  strike: number | null;
  /** What one unit costs today (the ask), $ per share. */
  cost: number;
  /** What it's worth after the news, $ per share. */
  after: number;
  /** Return on the money invested: (after − cost) / cost. */
  ret: number;
  /** Half the quoted spread as a fraction of the cost. */
  halfSpreadPct: number;
}

/** The stock and options of expiry T (years), valued one trading day later after a move J. */
export function venueReturns(J: number, T: number, strikes: number[], stockHalfSpread = 0.01): VenueResult[] {
  const S = DEFAULTS.S, S1 = S * (1 + J), dt = 1 / 252;
  const F = S * Math.exp(DEFAULTS.r * T);
  const sign = J >= 0 ? 1 : -1;
  const stockCost = S + sign * stockHalfSpread;
  const out: VenueResult[] = [{
    label: sign > 0 ? 'Buy stock' : 'Short stock',
    type: 'stock',
    strike: null,
    cost: stockCost,
    after: S1,
    ret: (sign * (S1 - stockCost)) / stockCost,
    halfSpreadPct: stockHalfSpread / S,
  }];
  const type: OptionType = sign > 0 ? 'call' : 'put';
  for (const K of strikes) {
    const q = quoteOption(type, K, T);
    if (q.ask <= 0) continue;
    // Sticky strike: the smile in strike stays put, the stock moves along it.
    const vol = ssviVol(Math.log(K / F), T, EQUITY_SSVI);
    const after = price(type, { ...DEFAULTS, S: S1, K, T: T - dt, sigma: vol });
    out.push({ label: `${K} ${type}`, type, strike: K, cost: q.ask, after, ret: (after - q.ask) / q.ask, halfSpreadPct: (q.ask - q.bid) / 2 / q.ask });
  }
  return out;
}
