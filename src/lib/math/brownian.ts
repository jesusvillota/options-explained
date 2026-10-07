import { mulberry32, normalRng } from './rng';

/**
 * Random walks and Brownian motion (Chapters 15–17). Paths are arrays of
 * values at n + 1 equally spaced times on [0, T].
 */

/** A symmetric ±√Δt coin-flip walk: the scaled random walk that converges to Brownian motion. */
export function scaledRandomWalk(seed: number, n: number, T = 1): number[] {
  const u = mulberry32(seed);
  const step = Math.sqrt(T / n);
  const out = [0];
  for (let i = 1; i <= n; i++) out.push(out[i - 1] + (u() < 0.5 ? step : -step));
  return out;
}

/** Standard Brownian motion sampled at n steps: independent N(0, Δt) increments. */
export function brownianPath(seed: number, n: number, T = 1): number[] {
  const z = normalRng(seed);
  const s = Math.sqrt(T / n);
  const out = [0];
  for (let i = 1; i <= n; i++) out.push(out[i - 1] + s * z());
  return out;
}

/** Running sum of squared increments, Σ (ΔW)²; converges to t for Brownian motion. */
export function runningQuadraticVariation(path: number[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + (path[i] - path[i - 1]) ** 2);
  return out;
}

/** Running sum of absolute increments, Σ |ΔW|; blows up like √n for Brownian motion. */
export function runningTotalVariation(path: number[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + Math.abs(path[i] - path[i - 1]));
  return out;
}

/**
 * For f(W) = W²: the naive chain-rule sum Σ 2 W_k ΔW_k (an Itô sum, evaluated at
 * the left endpoint) and the corrected version Σ 2 W_k ΔW_k + t. Itô's lemma says
 * W_t² = ∫ 2W dW + t, so the corrected sum tracks W_t² and the naive one falls behind by t.
 */
export function itoSquareSums(path: number[], T = 1): { naive: number[]; corrected: number[] } {
  const n = path.length - 1;
  const naive = [0];
  for (let i = 1; i <= n; i++) naive.push(naive[i - 1] + 2 * path[i - 1] * (path[i] - path[i - 1]));
  return { naive, corrected: naive.map((v, i) => v + (i * T) / n) };
}
