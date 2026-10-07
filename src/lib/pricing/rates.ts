/**
 * Time value of money and forwards (Chapter 6). Rates are annual; "continuous"
 * means continuously compounded, the convention used everywhere else in the course.
 */

/** Value at time T of 1 invested today at rate r compounded n times a year (n = Infinity: continuously). */
export function growthFactor(r: number, T: number, n = Infinity): number {
  return n === Infinity ? Math.exp(r * T) : (1 + r / n) ** (n * T);
}

/** Balance at time t (0 ≤ t ≤ T) when interest is credited n times a year: a staircase. */
export function balanceAt(r: number, t: number, n: number): number {
  if (n === Infinity) return Math.exp(r * t);
  const periods = Math.floor(t * n + 1e-9);
  return (1 + r / n) ** periods;
}

/** Discount factor B(0,T) = e^{−rT}: today's value of 1 paid at time T. */
export function discountFactor(r: number, T: number): number {
  return Math.exp(-r * T);
}

/** The continuously compounded rate equivalent to rate r compounded n times a year. */
export function continuousEquivalent(r: number, n: number): number {
  return n * Math.log(1 + r / n);
}

export interface ForwardInput {
  /** Spot price today */
  S: number;
  /** Risk-free rate */
  r: number;
  /** Continuous dividend (or carry) yield */
  q?: number;
  /** Time to delivery, in years */
  T: number;
}

/** No-arbitrage forward price F = S e^{(r−q)T}. */
export function forwardPrice({ S, r, q = 0, T }: ForwardInput): number {
  return S * Math.exp((r - q) * T);
}

/**
 * Today's value of a long forward agreeing to buy at price K at time T:
 * S e^{−qT} − K e^{−rT}. Zero exactly when K is the forward price.
 */
export function forwardValue(input: ForwardInput & { K: number }): number {
  const { S, r, q = 0, T, K } = input;
  return S * Math.exp(-q * T) - K * Math.exp(-r * T);
}

export interface ForwardArbitrage {
  /** 'cash-and-carry' if the market forward is too high, 'reverse' if too low, null if fair. */
  kind: 'cash-and-carry' | 'reverse' | null;
  /** Riskless profit at time T, per unit, ≥ 0. */
  profitAtT: number;
}

/** The riskless trade (if any) when a forward trades at marketF instead of the fair price. */
export function forwardArbitrage(input: ForwardInput, marketF: number, tolerance = 1e-9): ForwardArbitrage {
  const fair = forwardPrice(input);
  const gap = marketF - fair;
  if (Math.abs(gap) <= tolerance) return { kind: null, profitAtT: 0 };
  return { kind: gap > 0 ? 'cash-and-carry' : 'reverse', profitAtT: Math.abs(gap) };
}
