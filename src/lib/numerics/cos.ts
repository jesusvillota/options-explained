import { c, exp, log, mul, type Complex } from '../math/complex';
import type { CharFn } from '../models/fourier';

/**
 * The COS method (Fang and Oosterlee, 2008; Chapter 35). The density of
 * y = ln(S_T/F) on a truncation interval [a, b] is expanded in a cosine series
 * whose coefficients come straight from the characteristic function:
 *   f(y) ≈ Σ'_k A_k cos(u_k(y − a)),  u_k = kπ/(b − a),  A_k = 2/(b − a)·Re[φ(u_k)e^{−iu_k a}],
 * where Σ' halves the k = 0 term. Prices are then a finite sum.
 */

/** First two cumulants of y from the characteristic function, by finite differences of log φ at 0. */
export function cumulants(phi: CharFn, h = 1e-3): { c1: number; c2: number } {
  const lp = log(phi(c(h))), lm = log(phi(c(-h))), l0 = log(phi(c(0)));
  return { c1: (lp.im - lm.im) / (2 * h), c2: -(lp.re - 2 * l0.re + lm.re) / (h * h) };
}

export function truncationRange(phi: CharFn, L = 12): [number, number] {
  const { c1, c2 } = cumulants(phi);
  const w = L * Math.sqrt(Math.max(c2, 1e-8));
  return [c1 - w, c1 + w];
}

/** The cosine coefficients A_k, k = 0..n−1 (with the ½ on A_0 already applied). */
export function cosCoefficients(phi: CharFn, a: number, b: number, n: number): number[] {
  return Array.from({ length: n }, (_, k) => {
    const u = (k * Math.PI) / (b - a);
    const term: Complex = mul(phi(c(u)), exp(c(0, -u * a)));
    return ((k === 0 ? 0.5 : 1) * 2 * term.re) / (b - a);
  });
}

/** The density of y = ln(S_T/F) reconstructed from n cosine terms. */
export function cosDensity(phi: CharFn, y: number, n: number, range = truncationRange(phi)): number {
  const [a, b] = range;
  return cosCoefficients(phi, a, b, n).reduce((acc, A, k) => acc + A * Math.cos(((k * Math.PI) / (b - a)) * (y - a)), 0);
}

/** χ_k(c, d) = ∫_c^d e^y cos(u(y − a)) dy and ψ_k(c, d) = ∫_c^d cos(u(y − a)) dy. */
function chiPsi(u: number, a: number, cLo: number, d: number): { chi: number; psi: number } {
  const cd = Math.cos(u * (d - a)), cc = Math.cos(u * (cLo - a));
  const sd = Math.sin(u * (d - a)), sc = Math.sin(u * (cLo - a));
  const chi = (cd * Math.exp(d) - cc * Math.exp(cLo) + u * sd * Math.exp(d) - u * sc * Math.exp(cLo)) / (1 + u * u);
  const psi = u === 0 ? d - cLo : (sd - sc) / u;
  return { chi, psi };
}

/**
 * European call by COS with n terms. Prices the put (bounded payoff, more stable)
 * and converts with put–call parity.
 */
export function cosCallPrice(phi: CharFn, S: number, K: number, T: number, r: number, q = 0, n = 128, range = truncationRange(phi)): number {
  const [a, b] = range;
  const F = S * Math.exp((r - q) * T);
  const ell = Math.min(Math.max(Math.log(K / F), a), b); // the put pays K(1 − e^{y − ℓ}) for y < ℓ
  const A = cosCoefficients(phi, a, b, n);
  let put = 0;
  for (let k = 0; k < n; k++) {
    const u = (k * Math.PI) / (b - a);
    const { chi, psi } = chiPsi(u, a, a, ell);
    // ∫_a^ℓ K(1 − e^{y−ℓ}) cos(u(y − a)) dy
    const V = K * (psi - Math.exp(-ell) * chi);
    put += A[k] * V;
  }
  put *= Math.exp(-r * T);
  return put + S * Math.exp(-q * T) - K * Math.exp(-r * T);
}
