import { cdf, pdf } from '../math/normal';
import type { OptionType } from './payoff';
import { payoff } from './payoff';

/** Inputs to Black–Scholes. Time in years, rates continuously compounded. */
export interface BSInput {
  /** Spot S */
  S: number;
  /** Strike K */
  K: number;
  /** Time to expiry τ = T − t, in years */
  T: number;
  /** Risk-free rate r */
  r: number;
  /** Volatility σ */
  sigma: number;
  /** Continuous dividend yield q (default 0) */
  q?: number;
}

/** The course's default example (docs/STYLE_GUIDE.md §3). */
export const DEFAULTS: Required<BSInput> = { S: 100, K: 100, T: 1, r: 0.05, sigma: 0.2, q: 0 };

export function d1d2({ S, K, T, r, sigma, q = 0 }: BSInput): { d1: number; d2: number } {
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return { d1, d2: d1 - sigma * sqrtT };
}

const degenerate = ({ T, sigma }: BSInput) => T <= 0 || sigma <= 0;

/** Black–Scholes(–Merton) price of a European option. */
export function price(type: OptionType, input: BSInput): number {
  const { S, K, T, r, q = 0 } = input;
  if (degenerate(input)) {
    // No uncertainty left: the option is worth its discounted payoff on the forward.
    const tau = Math.max(T, 0);
    const forward = S * Math.exp((r - q) * tau);
    return Math.exp(-r * tau) * payoff(type, forward, K);
  }
  const { d1, d2 } = d1d2(input);
  const dfq = Math.exp(-q * T);
  const dfr = Math.exp(-r * T);
  return type === 'call'
    ? S * dfq * cdf(d1) - K * dfr * cdf(d2)
    : K * dfr * cdf(-d2) - S * dfq * cdf(-d1);
}

export interface Greeks {
  delta: number;
  gamma: number;
  /** ∂V/∂σ, per unit of σ (multiply by 0.01 for "per vol point") */
  vega: number;
  /** ∂V/∂t, per year (divide by 365 for "per day") */
  theta: number;
  /** ∂V/∂r, per unit of r */
  rho: number;
}

/** Closed-form Black–Scholes Greeks. Requires T > 0 and σ > 0. */
export function greeks(type: OptionType, input: BSInput): Greeks {
  const { S, K, T, r, sigma, q = 0 } = input;
  const { d1, d2 } = d1d2(input);
  const sqrtT = Math.sqrt(T);
  const dfq = Math.exp(-q * T);
  const dfr = Math.exp(-r * T);
  const gamma = (dfq * pdf(d1)) / (S * sigma * sqrtT);
  const vega = S * dfq * pdf(d1) * sqrtT;
  const decay = -(S * dfq * pdf(d1) * sigma) / (2 * sqrtT);
  if (type === 'call') {
    return {
      delta: dfq * cdf(d1),
      gamma,
      vega,
      theta: decay - r * K * dfr * cdf(d2) + q * S * dfq * cdf(d1),
      rho: K * T * dfr * cdf(d2),
    };
  }
  return {
    delta: -dfq * cdf(-d1),
    gamma,
    vega,
    theta: decay + r * K * dfr * cdf(-d2) - q * S * dfq * cdf(-d1),
    rho: -K * T * dfr * cdf(-d2),
  };
}
