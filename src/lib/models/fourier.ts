import type { Complex } from '../math/complex';
import { c, exp, mul } from '../math/complex';

/**
 * A model, for pricing purposes, is the characteristic function of
 * X = ln(S_T / F_T) under the risk-neutral measure, where F_T = S·e^{(r−q)T}:
 *   φ(u) = E[e^{iuX}],  u complex.
 * Martingale condition: φ(−i) = E[S_T/F_T] = 1.
 */
export type CharFn = (u: Complex) => Complex;

export interface FourierOptions {
  /** Upper limit of integration in u. */
  uMax?: number;
}

/** Gauss–Legendre nodes and weights on [−1, 1], computed once by Newton's method on P_n. */
function gaussLegendre(n: number): { x: number[]; w: number[] } {
  const x: number[] = [], w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = z;
      for (let k = 2; k <= n; k++) [p0, p1] = [p1, ((2 * k - 1) * z * p1 - (k - 1) * p0) / k];
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x.push(z);
    w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}
const GL = gaussLegendre(24);

/**
 * Quadrature nodes on [0, uMax]: Gauss–Legendre on intervals that start at
 * width ¼ near zero (where 1/(u² + ¼) peaks) and double up to a width of 8.
 */
function quadratureGrid(uMax: number): { u: number[]; w: number[] } {
  const u: number[] = [], w: number[] = [];
  let a = 0, width = 0.25;
  while (a < uMax) {
    const b = Math.min(a + width, uMax);
    const mid = 0.5 * (a + b), half = 0.5 * (b - a);
    GL.x.forEach((xi, i) => { u.push(mid + half * xi); w.push(half * GL.w[i]); });
    a = b;
    width = Math.min(width * 2, 8);
  }
  return { u, w };
}

/**
 * European call prices for many strikes by Lewis's (2001) formula:
 *   C = S e^{−qT} − (e^{−rT} √(F K) / π) ∫₀^∞ Re[e^{iu x} φ(u − i/2)] / (u² + ¼) du,
 * with x = ln(F/K). The characteristic function doesn't depend on K, so it is
 * evaluated once on the quadrature grid and reused for every strike.
 */
export function lewisCallPrices(phi: CharFn, S: number, strikes: number[], T: number, r: number, q = 0, { uMax = 200 }: FourierOptions = {}): number[] {
  const F = S * Math.exp((r - q) * T);
  const { u: us, w: ws } = quadratureGrid(uMax);
  const vals = us.map((u) => phi(c(u, -0.5)));
  return strikes.map((K) => {
    const x = Math.log(F / K);
    let integral = 0;
    us.forEach((u, j) => {
      integral += (ws[j] * mul(exp(c(0, u * x)), vals[j]).re) / (u * u + 0.25);
    });
    return S * Math.exp(-q * T) - (Math.exp(-r * T) * Math.sqrt(F * K) * integral) / Math.PI;
  });
}

export const lewisCallPrice = (phi: CharFn, S: number, K: number, T: number, r: number, q = 0, opts?: FourierOptions) =>
  lewisCallPrices(phi, S, [K], T, r, q, opts)[0];

/** Black–Scholes as a characteristic function: X ~ N(−σ²T/2, σ²T). */
export function blackScholesCF(sigma: number, T: number): CharFn {
  const v = sigma * sigma * T;
  // φ(u) = exp(−½v(iu + u²))
  return (u) => {
    const iu = c(-u.im, u.re);
    const u2 = mul(u, u);
    return exp(c(-0.5 * v * (iu.re + u2.re), -0.5 * v * (iu.im + u2.im)));
  };
}
