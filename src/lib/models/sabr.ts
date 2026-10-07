import { nelderMead } from '../math/optimize';
import { normalRng } from '../math/rng';

/**
 * SABR (Hagan, Kumar, Lesniewski and Woodward, 2002; Chapter 32), for a forward F:
 *   dF = α F^β dW¹,   dα = ν α dW²,   d⟨W¹, W²⟩ = ρ dt.
 */
export interface SABRParams {
  /** Initial volatility level α₀. */
  alpha: number;
  /** CEV exponent β ∈ [0, 1]: 0 normal, 1 lognormal. */
  beta: number;
  /** Correlation ρ between the forward and its volatility. */
  rho: number;
  /** Volatility of volatility ν. */
  nu: number;
}

/**
 * Hagan's approximation to the Black (lognormal) implied volatility of a
 * European option struck at K on a forward F with expiry T.
 */
export function sabrVol(F: number, K: number, T: number, { alpha, beta, rho, nu }: SABRParams): number {
  const b1 = 1 - beta;
  const logFK = Math.log(F / K);
  const fk = Math.pow(F * K, b1 / 2);
  const correction = 1 + ((b1 * b1 * alpha * alpha) / (24 * fk * fk) + (rho * beta * nu * alpha) / (4 * fk) + ((2 - 3 * rho * rho) * nu * nu) / 24) * T;
  const denom = fk * (1 + (b1 * b1 * logFK * logFK) / 24 + (b1 ** 4 * logFK ** 4) / 1920);
  const z = (nu / alpha) * fk * logFK;
  let zx = 1;
  if (Math.abs(z) > 1e-8) {
    const x = Math.log((Math.sqrt(1 - 2 * rho * z + z * z) + z - rho) / (1 - rho));
    zx = z / x;
  }
  return (alpha / denom) * zx * correction;
}

/**
 * Fit α, ρ and ν (β fixed, as is market practice) to implied vols by least
 * squares with Nelder–Mead, from a sensible start. Parameters are mapped to
 * their valid ranges (α > 0, |ρ| < 1, ν > 0) through smooth transforms.
 */
export function calibrateSabr(F: number, T: number, strikes: number[], vols: number[], beta: number, start: Partial<SABRParams> = {}): { params: SABRParams; rmse: number } {
  const atm = vols[strikes.reduce((best, K, i) => (Math.abs(K - F) < Math.abs(strikes[best] - F) ? i : best), 0)];
  const a0 = start.alpha ?? atm * Math.pow(F, 1 - beta);
  const unpack = ([la, tr, ln]: number[]): SABRParams => ({ alpha: Math.exp(la), beta, rho: Math.tanh(tr), nu: Math.exp(ln) });
  const loss = (x: number[]) => {
    const p = unpack(x);
    return strikes.reduce((acc, K, i) => acc + (sabrVol(F, K, T, p) - vols[i]) ** 2, 0) / strikes.length;
  };
  const x0 = [Math.log(a0), Math.atanh(start.rho ?? 0), Math.log(start.nu ?? 0.5)];
  const { x, fx } = nelderMead(loss, x0, { step: 0.3, tol: 1e-14, maxIter: 4000 });
  return { params: unpack(x), rmse: Math.sqrt(fx) };
}

/**
 * A seeded SABR path for the forward, with the volatility simulated exactly in
 * logs and the forward by Euler, absorbed at zero when β < 1.
 */
export function sabrPath(seed: number, F0: number, p: SABRParams, T: number, n: number): { F: number[]; alpha: number[] } {
  const z = normalRng(seed);
  const dt = T / n, sq = Math.sqrt(dt);
  const F = [F0], alpha = [p.alpha];
  let f = F0, a = p.alpha;
  for (let i = 0; i < n; i++) {
    const z1 = z();
    const z2 = p.rho * z1 + Math.sqrt(1 - p.rho * p.rho) * z();
    if (f > 0) f = Math.max(f + a * Math.pow(f, p.beta) * sq * z1, 0);
    a *= Math.exp(p.nu * sq * z2 - 0.5 * p.nu * p.nu * dt);
    F.push(f);
    alpha.push(a);
  }
  return { F, alpha };
}
