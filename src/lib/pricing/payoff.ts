/** Payoffs and profits at expiry. Chapters 1–2 and the strategy builder. */
export type OptionType = 'call' | 'put';
export type Side = 'long' | 'short';

/** (x)⁺ = max(x, 0) */
export const positivePart = (x: number): number => Math.max(x, 0);

/** Payoff to the holder of one option at expiry: (S_T − K)⁺ or (K − S_T)⁺. */
export function payoff(type: OptionType, spotAtExpiry: number, strike: number): number {
  return type === 'call' ? positivePart(spotAtExpiry - strike) : positivePart(strike - spotAtExpiry);
}

export interface Leg {
  type: OptionType;
  side: Side;
  strike: number;
  /** Premium per option, paid by the long side and received by the short side. */
  premium: number;
  quantity?: number;
}

const sign = (side: Side) => (side === 'long' ? 1 : -1);

/** Payoff of a position at expiry, ignoring the premium. */
export function legPayoff(leg: Leg, spotAtExpiry: number): number {
  return sign(leg.side) * (leg.quantity ?? 1) * payoff(leg.type, spotAtExpiry, leg.strike);
}

/** Profit of a position at expiry: payoff minus premium paid (or plus premium received). Ignores interest. */
export function legProfit(leg: Leg, spotAtExpiry: number): number {
  return legPayoff(leg, spotAtExpiry) - sign(leg.side) * (leg.quantity ?? 1) * leg.premium;
}

/** The spot at expiry where a single option position breaks even (profit = 0). */
export function breakeven(type: OptionType, strike: number, premium: number): number {
  return type === 'call' ? strike + premium : strike - premium;
}
