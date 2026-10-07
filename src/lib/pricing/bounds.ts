import type { BSInput } from './blackScholes';
import type { OptionType } from './payoff';

/**
 * Model-free no-arbitrage bounds on European option prices (Chapter 7).
 *   call:  max(S e^{−qT} − K e^{−rT}, 0) ≤ C ≤ S e^{−qT}
 *   put:   max(K e^{−rT} − S e^{−qT}, 0) ≤ P ≤ K e^{−rT}
 */
export function optionBounds(type: OptionType, { S, K, T, r, q = 0 }: BSInput): { lower: number; upper: number } {
  const stock = S * Math.exp(-q * T);
  const cash = K * Math.exp(-r * T);
  return type === 'call'
    ? { lower: Math.max(stock - cash, 0), upper: stock }
    : { lower: Math.max(cash - stock, 0), upper: cash };
}

export interface BoundViolation {
  bound: 'upper' | 'lower';
  /** Riskless profit locked in today (per option). */
  profitToday: number;
  /** The trade that captures it, in words. */
  trade: string;
}

/** If a market price breaks a bound, the riskless trade that exploits it; otherwise null. */
export function boundViolation(type: OptionType, input: BSInput, marketPrice: number, tolerance = 1e-9): BoundViolation | null {
  const { lower, upper } = optionBounds(type, input);
  if (marketPrice > upper + tolerance) {
    return {
      bound: 'upper',
      profitToday: marketPrice - upper,
      trade:
        type === 'call'
          ? 'Sell the call and buy the stock: you pocket the difference, and the share you hold covers you whatever the holder does.'
          : 'Sell the put and put K e^{−rT} in the bank: at expiry you have the strike in cash to buy the share if the put is exercised.',
    };
  }
  if (marketPrice < lower - tolerance) {
    return {
      bound: 'lower',
      profitToday: lower - marketPrice,
      trade:
        type === 'call'
          ? 'Buy the call, sell the stock short and lend K e^{−rT}: at expiry the loan returns K, and you close the short with max(S_T, K) − S_T ≥ 0 left over.'
          : 'Buy the put and the stock, and borrow K e^{−rT}: at expiry you can always sell the share for at least K, which repays the loan.',
    };
  }
  return null;
}
