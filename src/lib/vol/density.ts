import { price } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';
import type { MarketInput } from './impliedVol';

/** A smile: implied volatility as a function of log-moneyness k = ln(K/F). */
export type Smile = (k: number) => number;

export const forwardOf = ({ S, T, r, q = 0 }: MarketInput) => S * Math.exp((r - q) * T);

/** Price of a European option at strike K when the implied volatility follows a smile. */
export function smilePrice(type: OptionType, K: number, market: MarketInput, smile: Smile): number {
  const k = Math.log(K / forwardOf(market));
  return price(type, { ...market, K, sigma: smile(k) });
}

/**
 * The value, scaled by e^{rT}/h², of a butterfly with wings ±h around K:
 *   e^{rT} [C(K − h) − 2C(K) + C(K + h)] / h².
 * As h → 0 it converges to the risk-neutral density at K (Breeden–Litzenberger, 1978).
 */
export function butterflyDensity(callPrice: (K: number) => number, K: number, h: number, r: number, T: number): number {
  return (Math.exp(r * T) * (callPrice(K - h) - 2 * callPrice(K) + callPrice(K + h))) / (h * h);
}

/** Risk-neutral density of S_T implied by a smile, by Breeden–Litzenberger with a small step. */
export function impliedDensity(K: number, market: MarketInput, smile: Smile, h = 0.05): number {
  return butterflyDensity((x) => smilePrice('call', x, market, smile), K, h, market.r, market.T);
}

/** Risk-neutral probability that S_T > K, from the slope of call prices: −e^{rT} ∂C/∂K. */
export function impliedTailProbability(K: number, market: MarketInput, smile: Smile, h = 0.01): number {
  const c = (x: number) => smilePrice('call', x, market, smile);
  return (-Math.exp(market.r * market.T) * (c(K + h) - c(K - h))) / (2 * h);
}
