/**
 * The one-period binomial model (Chapters 11–12). Today the stock is S0; after
 * one period of length T it is either Su or Sd. A derivative paying Vu or Vd is
 * replicated by Δ shares plus a bond, and its price follows.
 */
export interface OneStepInput {
  S0: number;
  Su: number;
  Sd: number;
  /** Payoffs of the derivative in the up and down states. */
  Vu: number;
  Vd: number;
  r: number;
  T: number;
}

export interface Replication {
  /** Shares to hold: the slope of the line through (Sd, Vd) and (Su, Vu). */
  delta: number;
  /** Cash in the bond today (negative = borrowing). */
  bond: number;
  /** Price today = Δ S0 + bond. */
  price: number;
  /** Risk-neutral probability of the up move. */
  q: number;
  /** True if Sd < S0 e^{rT} < Su (otherwise the stock itself is an arbitrage). */
  arbitrageFree: boolean;
}

export function replicate({ S0, Su, Sd, Vu, Vd, r, T }: OneStepInput): Replication {
  const growth = Math.exp(r * T);
  const delta = (Vu - Vd) / (Su - Sd);
  const bond = (Vu - delta * Su) / growth;
  const q = (S0 * growth - Sd) / (Su - Sd);
  return { delta, bond, price: delta * S0 + bond, q, arbitrageFree: Sd < S0 * growth && S0 * growth < Su };
}

/** The same price as a discounted expectation under the risk-neutral probability q. */
export function riskNeutralPrice({ S0, Su, Sd, Vu, Vd, r, T }: OneStepInput): number {
  const q = (S0 * Math.exp(r * T) - Sd) / (Su - Sd);
  return Math.exp(-r * T) * (q * Vu + (1 - q) * Vd);
}
