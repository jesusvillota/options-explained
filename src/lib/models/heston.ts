import { add, c, div, exp, log, mul, scale, sqrt, sub, type Complex } from '../math/complex';
import { normalRng } from '../math/rng';
import { impliedVol } from '../vol/impliedVol';
import { lewisCallPrices, type CharFn } from './fourier';

/**
 * Heston (1993) stochastic volatility (Chapter 30):
 *   dS = (r − q)S dt + √v S dW¹,   dv = κ(θ − v) dt + ξ√v dW²,   d⟨W¹, W²⟩ = ρ dt.
 */
export interface HestonParams {
  /** Initial variance v₀. */
  v0: number;
  /** Mean-reversion speed κ. */
  kappa: number;
  /** Long-run variance θ. */
  theta: number;
  /** Volatility of variance ξ ("vol of vol"). */
  xi: number;
  /** Correlation ρ between the stock and its variance. */
  rho: number;
}

/** Equity-like defaults: 20% vol now and long-run, strongly negative correlation. */
export const HESTON_DEFAULTS: HestonParams = { v0: 0.04, kappa: 2, theta: 0.04, xi: 0.5, rho: -0.7 };

/** The Feller condition 2κθ ≥ ξ²: when it holds, variance never touches zero. */
export const fellerHolds = ({ kappa, theta, xi }: HestonParams) => 2 * kappa * theta >= xi * xi;

/**
 * Characteristic function of ln(S_T/F_T), in the numerically stable form of
 * Albrecher, Mayer, Schoutens and Tistaert ("the little Heston trap", 2007).
 */
export function hestonCF({ v0, kappa, theta, xi, rho }: HestonParams, T: number): CharFn {
  return (u: Complex) => {
    const iu = c(-u.im, u.re); // i·u
    const b = sub(c(kappa), scale(iu, rho * xi)); // κ − ρξ·iu
    const d = sqrt(add(mul(b, b), scale(add(iu, mul(u, u)), xi * xi))); // √(b² + ξ²(iu + u²))
    const g = div(sub(b, d), add(b, d));
    const edt = exp(scale(d, -T));
    const oneMinusGE = sub(c(1), mul(g, edt));
    const C = scale(sub(scale(sub(b, d), T), scale(log(div(oneMinusGE, sub(c(1), g))), 2)), (kappa * theta) / (xi * xi));
    const D = mul(scale(sub(b, d), 1 / (xi * xi)), div(sub(c(1), edt), oneMinusGE));
    return exp(add(C, scale(D, v0)));
  };
}

/** Heston call prices for several strikes at one maturity. */
export function hestonCallPrices(p: HestonParams, S: number, strikes: number[], T: number, r: number, q = 0): number[] {
  // Short maturities need a longer u-range: the integrand decays like exp(−½u²·v·T).
  const uMax = Math.min(Math.max(40 / Math.sqrt(Math.min(p.v0, p.theta, 0.04) * T + 1e-4), 100), 2000);
  return lewisCallPrices(hestonCF(p, T), S, strikes, T, r, q, { uMax });
}

/** Black–Scholes implied volatilities of Heston prices (NaN where a price is outside the bounds). */
export function hestonSmile(p: HestonParams, S: number, strikes: number[], T: number, r: number, q = 0): number[] {
  const prices = hestonCallPrices(p, S, strikes, T, r, q);
  return strikes.map((K, i) => impliedVol('call', prices[i], { S, K, T, r, q }).sigma);
}

/**
 * A seeded Heston path with full-truncation Euler (Lord, Koekkoek and van Dijk):
 * negative variance is floored at zero inside the drift and diffusion.
 * Returns n + 1 stock prices and variances.
 */
export function hestonPath(seed: number, S0: number, mu: number, p: HestonParams, T: number, n: number): { S: number[]; v: number[] } {
  const z = normalRng(seed);
  const dt = T / n, sq = Math.sqrt(dt);
  const S = [S0], v = [p.v0];
  let x = Math.log(S0), vt = p.v0;
  for (let i = 0; i < n; i++) {
    const z1 = z();
    const z2 = p.rho * z1 + Math.sqrt(1 - p.rho * p.rho) * z();
    const vp = Math.max(vt, 0);
    x += (mu - 0.5 * vp) * dt + Math.sqrt(vp) * sq * z1;
    vt += p.kappa * (p.theta - vp) * dt + p.xi * Math.sqrt(vp) * sq * z2;
    S.push(Math.exp(x));
    v.push(Math.max(vt, 0));
  }
  return { S, v };
}

/**
 * Fair variance-swap strike under Heston: the expected average variance,
 *   (1/T) E∫v dt = θ + (v₀ − θ)(1 − e^{−κT})/(κT).
 */
export function hestonVarianceSwap({ v0, kappa, theta }: HestonParams, T: number): number {
  return theta + ((v0 - theta) * (1 - Math.exp(-kappa * T))) / (kappa * T);
}
