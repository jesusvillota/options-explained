/**
 * Closed-form results for American options (Chapter 9).
 *
 * Perpetual American put (no expiry, no dividends): exercise when S falls to
 *   S* = γK / (1 + γ),  γ = 2r / σ²,
 * and for S ≥ S* the value is (K − S*)(S / S*)^{−γ}. At S* the value curve
 * touches the payoff K − S with the same slope −1 ("smooth pasting").
 */
export function perpetualPutBoundary(K: number, r: number, sigma: number): number {
  const gamma = (2 * r) / (sigma * sigma);
  return (gamma * K) / (1 + gamma);
}

export function perpetualPut(S: number, K: number, r: number, sigma: number): number {
  const gamma = (2 * r) / (sigma * sigma);
  const star = perpetualPutBoundary(K, r, sigma);
  return S <= star ? K - S : (K - star) * (S / star) ** -gamma;
}
