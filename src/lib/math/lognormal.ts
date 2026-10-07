import { cdf } from './normal';

/**
 * Lognormal distribution of S_T = S0 exp((mu − σ²/2) T + σ √T Z), Z ~ N(0, 1)
 * (Chapters 14 and 16). `mu` is the drift (r under the pricing measure).
 */
export interface LognormalParams {
  S0: number;
  mu: number;
  sigma: number;
  T: number;
}

const params = ({ S0, mu, sigma, T }: LognormalParams) => ({
  m: Math.log(S0) + (mu - 0.5 * sigma * sigma) * T,
  s: sigma * Math.sqrt(T),
});

export function lognormalPdf(x: number, p: LognormalParams): number {
  if (x <= 0) return 0;
  const { m, s } = params(p);
  const z = (Math.log(x) - m) / s;
  return Math.exp(-0.5 * z * z) / (x * s * Math.sqrt(2 * Math.PI));
}

export function lognormalCdf(x: number, p: LognormalParams): number {
  if (x <= 0) return 0;
  const { m, s } = params(p);
  return cdf((Math.log(x) - m) / s);
}

export const lognormalMean = ({ S0, mu, T }: LognormalParams) => S0 * Math.exp(mu * T);
export const lognormalMedian = ({ S0, mu, sigma, T }: LognormalParams) => S0 * Math.exp((mu - 0.5 * sigma * sigma) * T);
