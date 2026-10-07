import { cdf } from '../math/normal';

/**
 * A yield curve (Chapter 41) in the Nelson–Siegel form: continuously
 * compounded zero rates
 *   z(t) = β₀ + β₁(1 − e^{−t/λ})/(t/λ) + β₂[(1 − e^{−t/λ})/(t/λ) − e^{−t/λ}],
 * level, slope and curvature. Discount factors P(0, t) = e^{−z(t)t}.
 */
export interface NelsonSiegel {
  b0: number;
  b1: number;
  b2: number;
  lambda: number;
}

export const NS_DEFAULT: NelsonSiegel = { b0: 0.04, b1: -0.01, b2: 0.01, lambda: 2 };

export function zeroRate(t: number, { b0, b1, b2, lambda }: NelsonSiegel): number {
  if (t < 1e-9) return b0 + b1;
  const x = t / lambda;
  const f = (1 - Math.exp(-x)) / x;
  return b0 + b1 * f + b2 * (f - Math.exp(-x));
}

export const discount = (t: number, c: NelsonSiegel) => Math.exp(-zeroRate(t, c) * t);

/** Simply compounded forward rate for [t₁, t₂]: (P(t₁)/P(t₂) − 1)/(t₂ − t₁). */
export const forwardRate = (t1: number, t2: number, c: NelsonSiegel) => (discount(t1, c) / discount(t2, c) - 1) / (t2 - t1);

/**
 * Bachelier's normal model: the forward moves by σ_N√T in absolute terms, so
 * negative rates are no problem. call = P[(F − K)N(d) + σ_N√T φ(d)], d = (F − K)/(σ_N√T).
 */
export function bachelier(type: 'call' | 'put', F: number, K: number, T: number, sigmaN: number, P: number): number {
  const s = sigmaN * Math.sqrt(T);
  if (s < 1e-14) return P * Math.max(type === 'call' ? F - K : K - F, 0);
  const d = (F - K) / s;
  const phi = Math.exp(-0.5 * d * d) / Math.sqrt(2 * Math.PI);
  return type === 'call' ? P * ((F - K) * cdf(d) + s * phi) : P * ((K - F) * cdf(-d) + s * phi);
}

/**
 * Black's (1976) formula for an option on a forward F with strike K, expiry T
 * and lognormal volatility σ, paid at a time with discount factor P:
 *   call = P[F N(d₁) − K N(d₂)],  put = P[K N(−d₂) − F N(−d₁)].
 */
export function black76(type: 'call' | 'put', F: number, K: number, T: number, sigma: number, P: number): number {
  const s = sigma * Math.sqrt(T);
  // Lognormal rates can't be zero or negative: fall back to intrinsic value there
  // (markets use the normal, Bachelier, model or a shifted forward instead).
  if (s < 1e-12 || F <= 0 || K <= 0) return P * Math.max(type === 'call' ? F - K : K - F, 0);
  const d1 = (Math.log(F / K) + 0.5 * s * s) / s, d2 = d1 - s;
  return type === 'call' ? P * (F * cdf(d1) - K * cdf(d2)) : P * (K * cdf(-d2) - F * cdf(-d1));
}

export interface CapletQuote {
  /** Start and end of the accrual period. */
  start: number;
  end: number;
  forward: number;
  price: number;
}

/**
 * A cap with strike K: a caplet on each period [t_{i−1}, t_i] of length τ,
 * paying τ(L − K)⁺ at t_i, where L is the rate fixed at t_{i−1}. Each caplet
 * is a Black-76 call on the forward rate, discounted from its payment date.
 * The first period (already fixed today) is excluded, as is market practice.
 */
export function capPrice(K: number, maturity: number, tau: number, sigma: number, curve: NelsonSiegel, type: 'call' | 'put' = 'call'): { total: number; caplets: CapletQuote[] } {
  const n = Math.round(maturity / tau);
  const caplets: CapletQuote[] = [];
  for (let i = 2; i <= n; i++) {
    const start = (i - 1) * tau, end = i * tau;
    const forward = forwardRate(start, end, curve);
    caplets.push({ start, end, forward, price: tau * black76(type, forward, K, start, sigma, discount(end, curve)) });
  }
  return { total: caplets.reduce((a, c) => a + c.price, 0), caplets };
}

/** Annuity (PV01) of a swap paying every τ from `start` to `end`: Σ τ P(0, t_i). */
export function annuity(start: number, end: number, tau: number, curve: NelsonSiegel): number {
  let a = 0;
  for (let t = start + tau; t <= end + 1e-9; t += tau) a += tau * discount(t, curve);
  return a;
}

/** Forward par swap rate for a swap from `start` to `end`: (P(start) − P(end)) / annuity. */
export const swapRate = (start: number, end: number, tau: number, curve: NelsonSiegel) =>
  (discount(start, curve) - discount(end, curve)) / annuity(start, end, tau, curve);

/**
 * Payer swaption (right to pay fixed K on a swap from T to T + tenor): under the
 * annuity measure, the swap rate is a martingale, so it's Black-76 on the
 * forward swap rate, scaled by the annuity.
 */
export function swaption(type: 'payer' | 'receiver', K: number, expiry: number, tenor: number, tau: number, sigma: number, curve: NelsonSiegel): number {
  const A = annuity(expiry, expiry + tenor, tau, curve);
  const S = swapRate(expiry, expiry + tenor, tau, curve);
  return A * black76(type === 'payer' ? 'call' : 'put', S, K, expiry, sigma, 1);
}
