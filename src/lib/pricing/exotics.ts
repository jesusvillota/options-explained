import { cdf, pdf } from '../math/normal';
import { normalRng } from '../math/rng';
import { d1d2, price, type BSInput } from './blackScholes';
import type { OptionType } from './payoff';

/* ------------------------------------------------------------------ */
/* Path-independent exotics (Chapter 37)                               */
/* ------------------------------------------------------------------ */

/** Cash-or-nothing digital: pays 1 if S_T ends in the money. e^{−rT}N(±d₂). */
export function digitalCash(type: OptionType, input: BSInput): number {
  const { d2 } = d1d2(input);
  return Math.exp(-input.r * input.T) * cdf(type === 'call' ? d2 : -d2);
}

/** Asset-or-nothing digital: pays S_T if it ends in the money. S e^{−qT}N(±d₁). */
export function digitalAsset(type: OptionType, input: BSInput): number {
  const { d1 } = d1d2(input);
  return input.S * Math.exp(-(input.q ?? 0) * input.T) * cdf(type === 'call' ? d1 : -d1);
}

/** Delta of the cash digital call: e^{−rT}φ(d₂)/(Sσ√T). It spikes at the strike near expiry. */
export function digitalCallDelta(input: BSInput): number {
  const { d2 } = d1d2(input);
  return (Math.exp(-input.r * input.T) * pdf(d2)) / (input.S * input.sigma * Math.sqrt(input.T));
}

/**
 * A call spread replicating the digital: long 1/h calls at K − h/2, short 1/h
 * calls at K + h/2. Its payoff ramps from 0 to 1 across the strike; as h → 0
 * it becomes the digital's step.
 */
export function callSpreadDigital(input: BSInput, h: number): number {
  return (price('call', { ...input, K: input.K - h / 2 }) - price('call', { ...input, K: input.K + h / 2 })) / h;
}

/** Payoff of that call spread at expiry. */
export const callSpreadPayoff = (ST: number, K: number, h: number) => Math.min(Math.max((ST - (K - h / 2)) / h, 0), 1);

/**
 * Gap call: pays S_T − K₂ whenever S_T > K₁ (the trigger), which can be
 * negative if K₂ > K₁. Value: S e^{−qT}N(d₁) − K₂e^{−rT}N(d₂), with d's at K₁.
 */
export function gapCall(input: BSInput, trigger: number, strike: number): number {
  const at = { ...input, K: trigger };
  return digitalAsset('call', at) - strike * digitalCash('call', at);
}

/**
 * Power call: pays (S_T^n − K)⁺. S_T^n is lognormal with volatility nσ and
 * forward F_n = Sⁿ exp(n(r − q)T + ½n(n − 1)σ²T), so Black's formula applies.
 */
export function powerCall({ S, K, T, r, sigma, q = 0 }: BSInput, n: number): number {
  const Fn = S ** n * Math.exp(n * (r - q) * T + 0.5 * n * (n - 1) * sigma * sigma * T);
  const s = n * sigma * Math.sqrt(T);
  const d1 = (Math.log(Fn / K) + 0.5 * s * s) / s;
  return Math.exp(-r * T) * (Fn * cdf(d1) - K * cdf(d1 - s));
}

/* ------------------------------------------------------------------ */
/* Barrier options (Chapter 38)                                        */
/* ------------------------------------------------------------------ */

export type BarrierKind = 'down-and-out' | 'down-and-in' | 'up-and-out' | 'up-and-in';

/**
 * European barrier options with continuous monitoring and no rebate
 * (Merton 1973; Reiner and Rubinstein 1991; formulas as in Hull). In + out
 * always equals the vanilla.
 */
export function barrierPrice(type: OptionType, kind: BarrierKind, input: BSInput, H: number): number {
  const { S, K, T, r, sigma, q = 0 } = input;
  const vanilla = price(type, input);
  const down = kind.startsWith('down');
  const isIn = kind.endsWith('in');
  // Already through the barrier: knocked in or out today.
  if ((down && S <= H) || (!down && S >= H)) return isIn ? vanilla : 0;
  const sq = sigma * Math.sqrt(T);
  const lambda = (r - q + 0.5 * sigma * sigma) / (sigma * sigma);
  const y = Math.log((H * H) / (S * K)) / sq + lambda * sq;
  const x1 = Math.log(S / H) / sq + lambda * sq;
  const y1 = Math.log(H / S) / sq + lambda * sq;
  const dq = Math.exp(-q * T), dr = Math.exp(-r * T);
  const hs2l = (H / S) ** (2 * lambda), hs2l2 = (H / S) ** (2 * lambda - 2);
  const N = cdf;
  let knockIn: number;
  if (type === 'call') {
    if (down) {
      knockIn = H <= K
        ? S * dq * hs2l * N(y) - K * dr * hs2l2 * N(y - sq)
        : vanilla - (S * N(x1) * dq - K * dr * N(x1 - sq) - S * dq * hs2l * N(y1) + K * dr * hs2l2 * N(y1 - sq));
    } else {
      knockIn = H <= K
        ? vanilla
        : S * N(x1) * dq - K * dr * N(x1 - sq) - S * dq * hs2l * (N(-y) - N(-y1)) + K * dr * hs2l2 * (N(-y + sq) - N(-y1 + sq));
    }
  } else {
    if (down) {
      knockIn = H >= K
        ? vanilla
        : -S * N(-x1) * dq + K * dr * N(-x1 + sq) + S * dq * hs2l * (N(y) - N(y1)) - K * dr * hs2l2 * (N(y - sq) - N(y1 - sq));
    } else {
      knockIn = H >= K
        ? -S * dq * hs2l * N(-y) + K * dr * hs2l2 * N(-y + sq)
        : vanilla - (-S * N(-x1) * dq + K * dr * N(-x1 + sq) + S * dq * hs2l * N(-y1) - K * dr * hs2l2 * N(-y1 + sq));
    }
  }
  knockIn = Math.min(Math.max(knockIn, 0), vanilla);
  return isIn ? knockIn : vanilla - knockIn;
}

/**
 * Broadie, Glasserman and Kou (1997): a barrier monitored at discrete dates Δt
 * apart is priced like a continuous one with the barrier shifted away from the
 * spot by the factor e^{±0.5826σ√Δt}.
 */
export function discreteBarrierShift(H: number, S: number, sigma: number, dt: number): number {
  const beta = 0.5826;
  return H * Math.exp((H > S ? 1 : -1) * beta * sigma * Math.sqrt(dt));
}

/** Monte Carlo of a discretely monitored barrier option (monitoring at every step). */
export function barrierMC(type: OptionType, kind: BarrierKind, input: BSInput, H: number, steps: number, paths: number, seed: number): { price: number; stdError: number } {
  const { S, K, T, r, sigma, q = 0 } = input;
  const z = normalRng(seed);
  const dt = T / steps, drift = (r - q - 0.5 * sigma * sigma) * dt, vol = sigma * Math.sqrt(dt);
  const down = kind.startsWith('down'), isIn = kind.endsWith('in');
  let sum = 0, sum2 = 0;
  for (let p = 0; p < paths; p++) {
    let x = Math.log(S), hit = down ? S <= H : S >= H;
    for (let i = 0; i < steps; i++) {
      x += drift + vol * z();
      const s = Math.exp(x);
      if (down ? s <= H : s >= H) hit = true;
    }
    const ST = Math.exp(x);
    const pay = hit === isIn ? Math.max(type === 'call' ? ST - K : K - ST, 0) : 0;
    const v = Math.exp(-r * T) * pay;
    sum += v; sum2 += v * v;
  }
  const mean = sum / paths;
  return { price: mean, stdError: Math.sqrt(Math.max(sum2 / paths - mean * mean, 0) / paths) };
}

/* ------------------------------------------------------------------ */
/* Asian options (Chapter 38)                                          */
/* ------------------------------------------------------------------ */

/**
 * Geometric-average Asian with n equally spaced fixings t_i = iT/n. ln G is
 * normal with mean ln S + (r − q − ½σ²)T(n + 1)/(2n) and variance
 * σ²T(n + 1)(2n + 1)/(6n²), so the price is a Black-type formula.
 */
export function geometricAsian(type: OptionType, { S, K, T, r, sigma, q = 0 }: BSInput, n: number): number {
  const mu = Math.log(S) + (r - q - 0.5 * sigma * sigma) * (T * (n + 1)) / (2 * n);
  const v = (sigma * sigma * T * (n + 1) * (2 * n + 1)) / (6 * n * n);
  const s = Math.sqrt(v);
  const d1 = (mu - Math.log(K) + v) / s, d2 = d1 - s;
  const EG = Math.exp(mu + 0.5 * v);
  const disc = Math.exp(-r * T);
  return type === 'call' ? disc * (EG * cdf(d1) - K * cdf(d2)) : disc * (K * cdf(-d2) - EG * cdf(-d1));
}

/**
 * Arithmetic-average Asian by Monte Carlo, optionally with the geometric Asian
 * as a control variate (Kemna and Vorst, 1990): the two payoffs are almost
 * perfectly correlated and the geometric one has a known price.
 */
export function arithmeticAsianMC(type: OptionType, input: BSInput, n: number, paths: number, seed: number, control = true): { price: number; stdError: number; plain: number; plainStdError: number } {
  const { S, K, T, r, sigma, q = 0 } = input;
  const z = normalRng(seed);
  const dt = T / n, drift = (r - q - 0.5 * sigma * sigma) * dt, vol = sigma * Math.sqrt(dt), disc = Math.exp(-r * T);
  const geoExact = geometricAsian(type, input, n);
  const ys: number[] = [], xs: number[] = [];
  for (let p = 0; p < paths; p++) {
    let x = Math.log(S), arith = 0, logSum = 0;
    for (let i = 0; i < n; i++) {
      x += drift + vol * z();
      arith += Math.exp(x);
      logSum += x;
    }
    const A = arith / n, G = Math.exp(logSum / n);
    const pay = (avg: number) => Math.max(type === 'call' ? avg - K : K - avg, 0);
    ys.push(disc * pay(A));
    xs.push(disc * pay(G));
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const my = mean(ys), mx = mean(xs);
  const vy = mean(ys.map((v) => (v - my) ** 2));
  const vx = mean(xs.map((v) => (v - mx) ** 2));
  const cxy = mean(ys.map((v, i) => (v - my) * (xs[i] - mx)));
  const b = control && vx > 0 ? cxy / vx : 0;
  const est = my - b * (mx - geoExact);
  const resid = Math.max(vy - 2 * b * cxy + b * b * vx, 0);
  return { price: est, stdError: Math.sqrt(resid / paths), plain: my, plainStdError: Math.sqrt(vy / paths) };
}

/* ------------------------------------------------------------------ */
/* Multi-asset options (Chapter 39)                                     */
/* ------------------------------------------------------------------ */

/**
 * Margrabe (1978): the option to exchange asset 2 for asset 1, paying
 * (S₁(T) − S₂(T))⁺. Measured in units of asset 2 it's a call with strike 1 and
 * volatility σ = √(σ₁² + σ₂² − 2ρσ₁σ₂), with no interest rate.
 */
export function margrabe(S1: number, S2: number, T: number, sigma1: number, sigma2: number, rho: number, q1 = 0, q2 = 0): number {
  const s = Math.sqrt(sigma1 * sigma1 + sigma2 * sigma2 - 2 * rho * sigma1 * sigma2) * Math.sqrt(T);
  const F1 = S1 * Math.exp(-q1 * T), F2 = S2 * Math.exp(-q2 * T);
  if (s < 1e-12) return Math.max(F1 - F2, 0);
  const d1 = (Math.log(F1 / F2) + 0.5 * s * s) / s;
  return F1 * cdf(d1) - F2 * cdf(d1 - s);
}

/**
 * Two correlated GBM paths from independent normals via the Cholesky factor
 * of [[1, ρ], [ρ, 1]]: Z₂ = ρZ₁ + √(1 − ρ²)Z′.
 */
export function correlatedPaths(seed: number, S1: number, S2: number, sigma1: number, sigma2: number, rho: number, mu: number, T: number, n: number): [number[], number[]] {
  const z = normalRng(seed);
  const dt = T / n;
  const a = [S1], b = [S2];
  for (let i = 0; i < n; i++) {
    const z1 = z();
    const z2 = rho * z1 + Math.sqrt(1 - rho * rho) * z();
    a.push(a[i] * Math.exp((mu - 0.5 * sigma1 * sigma1) * dt + sigma1 * Math.sqrt(dt) * z1));
    b.push(b[i] * Math.exp((mu - 0.5 * sigma2 * sigma2) * dt + sigma2 * Math.sqrt(dt) * z2));
  }
  return [a, b];
}

export interface TwoAssetInput {
  S1: number;
  S2: number;
  sigma1: number;
  sigma2: number;
  rho: number;
  T: number;
  r: number;
}

/**
 * Monte Carlo for two-asset European payoffs g(S₁(T), S₂(T)): exact
 * terminal sampling, antithetic pairs.
 */
export function twoAssetMC(g: (a: number, b: number) => number, { S1, S2, sigma1, sigma2, rho, T, r }: TwoAssetInput, paths: number, seed: number): { price: number; stdError: number } {
  const z = normalRng(seed);
  const m1 = (r - 0.5 * sigma1 * sigma1) * T, m2 = (r - 0.5 * sigma2 * sigma2) * T, s1 = sigma1 * Math.sqrt(T), s2 = sigma2 * Math.sqrt(T);
  const disc = Math.exp(-r * T), c = Math.sqrt(1 - rho * rho);
  let sum = 0, sum2 = 0;
  const pairs = Math.max(1, Math.floor(paths / 2));
  for (let p = 0; p < pairs; p++) {
    const z1 = z(), z2 = rho * z1 + c * z();
    const v = 0.5 * disc * (g(S1 * Math.exp(m1 + s1 * z1), S2 * Math.exp(m2 + s2 * z2)) + g(S1 * Math.exp(m1 - s1 * z1), S2 * Math.exp(m2 - s2 * z2)));
    sum += v; sum2 += v * v;
  }
  const mean = sum / pairs;
  return { price: mean, stdError: Math.sqrt(Math.max(sum2 / pairs - mean * mean, 0) / pairs) };
}
