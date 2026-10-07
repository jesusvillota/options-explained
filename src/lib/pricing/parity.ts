/**
 * Put–call parity (Chapter 8): for European options with the same strike and expiry,
 *   C − P = S e^{−qT} − K e^{−rT}.
 */
export interface ParityInput {
  S: number;
  K: number;
  r: number;
  T: number;
  q?: number;
}

/** Right-hand side of parity: the value of a forward with delivery price K. */
export function parityValue({ S, K, r, T, q = 0 }: ParityInput): number {
  return S * Math.exp(-q * T) - K * Math.exp(-r * T);
}

/** How far quoted C − P is from parity (positive: calls rich relative to puts). */
export function parityGap(call: number, put: number, input: ParityInput): number {
  return call - put - parityValue(input);
}

/** The put price implied by a call price (and vice versa). */
export const putFromCall = (call: number, input: ParityInput) => call - parityValue(input);
export const callFromPut = (put: number, input: ParityInput) => put + parityValue(input);

/** The forward price implied by a call and a put at strike K: F = K + e^{rT}(C − P). */
export function impliedForward(call: number, put: number, K: number, r: number, T: number): number {
  return K + Math.exp(r * T) * (call - put);
}

export interface ParityTrade {
  kind: 'conversion' | 'reversal' | null;
  /** Riskless profit locked in today, per share. */
  profitToday: number;
}

/**
 * Conversion (C − P too high): sell the call, buy the put, buy the stock, borrow K e^{−rT}.
 * Reversal (C − P too low): the opposite.
 */
export function parityTrade(call: number, put: number, input: ParityInput, tolerance = 1e-9): ParityTrade {
  const gap = parityGap(call, put, input);
  if (Math.abs(gap) <= tolerance) return { kind: null, profitToday: 0 };
  return { kind: gap > 0 ? 'conversion' : 'reversal', profitToday: Math.abs(gap) };
}

/** A box spread (long K1 call spread + long K2 put spread) pays K2 − K1 for sure: worth (K2 − K1) e^{−rT}. */
export function boxValue(K1: number, K2: number, r: number, T: number): number {
  return (K2 - K1) * Math.exp(-r * T);
}
