import { add, c, exp, mul, div, sub, type Complex } from '../math/complex';
import { normalRng, mulberry32 } from '../math/rng';
import { price } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';
import type { CharFn } from './fourier';

/**
 * Merton (1976) jump diffusion (Chapter 31): GBM plus jumps arriving at rate λ,
 * each multiplying the price by e^J with J ~ N(μ_J, δ²).
 */
export interface MertonParams {
  sigma: number;
  lambda: number;
  muJ: number;
  delta: number;
}

export const MERTON_DEFAULTS: MertonParams = { sigma: 0.15, lambda: 0.5, muJ: -0.1, delta: 0.1 };

/** Mean relative jump size k̄ = E[e^J − 1]; the drift is reduced by λk̄ to compensate. */
export const mertonKbar = ({ muJ, delta }: MertonParams) => Math.exp(muJ + 0.5 * delta * delta) - 1;

/**
 * Merton's series: a Poisson-weighted sum of Black–Scholes prices, conditioning
 * on n jumps. With λ' = λ(1 + k̄), σ_n² = σ² + nδ²/T and r_n = r − λk̄ + n·ln(1 + k̄)/T:
 *   V = Σ e^{−λ'T}(λ'T)ⁿ/n! · BS(σ_n, r_n).
 */
export function mertonPrice(type: OptionType, S: number, K: number, T: number, r: number, p: MertonParams, terms = 60): number {
  const kbar = mertonKbar(p);
  const lp = p.lambda * (1 + kbar);
  let weight = Math.exp(-lp * T);
  let total = 0;
  for (let n = 0; n < terms; n++) {
    if (n > 0) weight *= (lp * T) / n;
    const sigmaN = Math.sqrt(p.sigma * p.sigma + (n * p.delta * p.delta) / T);
    const rN = r - p.lambda * kbar + (n * Math.log(1 + kbar)) / T;
    total += weight * price(type, { S, K, T, r: rN, sigma: sigmaN });
    if (n > lp * T + 10 && weight < 1e-16) break;
  }
  return total;
}

/** Characteristic function of ln(S_T/F_T) under Merton's model. */
export function mertonCF(p: MertonParams, T: number): CharFn {
  const kbar = mertonKbar(p);
  return (u: Complex) => {
    const iu = c(-u.im, u.re);
    const u2 = mul(u, u);
    // diffusion: −½σ²(iu + u²); compensator: −iu·λk̄; jumps: λ(e^{iuμ_J − ½δ²u²} − 1)
    const diff = c(-0.5 * p.sigma * p.sigma * (iu.re + u2.re), -0.5 * p.sigma * p.sigma * (iu.im + u2.im));
    const comp = c(-p.lambda * kbar * iu.re, -p.lambda * kbar * iu.im);
    const jump = exp(c(p.muJ * iu.re - 0.5 * p.delta * p.delta * u2.re, p.muJ * iu.im - 0.5 * p.delta * p.delta * u2.im));
    const jumps = c(p.lambda * (jump.re - 1), p.lambda * jump.im);
    const total = add(add(diff, comp), jumps);
    return exp(c(total.re * T, total.im * T));
  };
}

/**
 * Density of ln(S_T/S_0) under Merton's model, a Poisson mixture of normals,
 * with real-world drift mu for the diffusion part.
 */
export function mertonLogDensity(x: number, T: number, mu: number, p: MertonParams, terms = 60): number {
  const kbar = mertonKbar(p);
  let weight = Math.exp(-p.lambda * T);
  let total = 0;
  for (let n = 0; n < terms; n++) {
    if (n > 0) weight *= (p.lambda * T) / n;
    const mean = (mu - p.lambda * kbar - 0.5 * p.sigma * p.sigma) * T + n * p.muJ;
    const v = p.sigma * p.sigma * T + n * p.delta * p.delta;
    total += (weight * Math.exp(-((x - mean) ** 2) / (2 * v))) / Math.sqrt(2 * Math.PI * v);
  }
  return total;
}

/**
 * Kou (2002) double-exponential jumps: up-jumps with probability p and mean 1/η₁,
 * down-jumps with mean 1/η₂ (η₁ > 1 so that E[e^J] is finite).
 */
export interface KouParams {
  sigma: number;
  lambda: number;
  p: number;
  eta1: number;
  eta2: number;
}

export const KOU_DEFAULTS: KouParams = { sigma: 0.15, lambda: 1, p: 0.3, eta1: 25, eta2: 10 };

export const kouKbar = ({ p, eta1, eta2 }: KouParams) => (p * eta1) / (eta1 - 1) + ((1 - p) * eta2) / (eta2 + 1) - 1;

/** Characteristic function of ln(S_T/F_T) under Kou's model. */
export function kouCF(k: KouParams, T: number): CharFn {
  const kbar = kouKbar(k);
  return (u: Complex) => {
    const iu = c(-u.im, u.re);
    const u2 = mul(u, u);
    const diff = c(-0.5 * k.sigma * k.sigma * (iu.re + u2.re), -0.5 * k.sigma * k.sigma * (iu.im + u2.im));
    const comp = c(-k.lambda * kbar * iu.re, -k.lambda * kbar * iu.im);
    // E[e^{iuJ}] = p·η₁/(η₁ − iu) + (1 − p)·η₂/(η₂ + iu)
    const up = div(c(k.p * k.eta1), sub(c(k.eta1), iu));
    const down = div(c((1 - k.p) * k.eta2), add(c(k.eta2), iu));
    const jumpCF = add(up, down);
    const jumps = c(k.lambda * (jumpCF.re - 1), k.lambda * jumpCF.im);
    const total = add(add(diff, comp), jumps);
    return exp(c(total.re * T, total.im * T));
  };
}

/**
 * A seeded Merton path on n steps: diffusion plus Poisson jumps. Also returns
 * the step indices where jumps happened, so a plot can mark them.
 */
export function mertonPath(seed: number, S0: number, mu: number, p: MertonParams, T: number, n: number): { S: number[]; jumps: number[] } {
  const z = normalRng(seed);
  const u = mulberry32(seed * 7919 + 13);
  const dt = T / n;
  const kbar = mertonKbar(p);
  const S = [S0];
  const jumps: number[] = [];
  let x = Math.log(S0);
  for (let i = 1; i <= n; i++) {
    x += (mu - p.lambda * kbar - 0.5 * p.sigma * p.sigma) * dt + p.sigma * Math.sqrt(dt) * z();
    // Number of jumps in this step: Poisson(λdt) by inversion (almost always 0 or 1).
    let k = 0, prob = Math.exp(-p.lambda * dt), cum = prob;
    const draw = u();
    while (draw > cum && k < 20) { k++; prob *= (p.lambda * dt) / k; cum += prob; }
    for (let j = 0; j < k; j++) x += p.muJ + p.delta * z();
    if (k > 0) jumps.push(i);
    S.push(Math.exp(x));
  }
  return { S, jumps };
}
