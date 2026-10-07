import { normalRng } from './rng';

/**
 * Autocovariance of fractional Gaussian noise (unit-variance increments of
 * fractional Brownian motion on a unit grid) at lag k:
 *   γ(k) = ½(|k + 1|^{2H} − 2|k|^{2H} + |k − 1|^{2H}).
 */
export const fgnCovariance = (k: number, H: number) =>
  0.5 * (Math.abs(k + 1) ** (2 * H) - 2 * Math.abs(k) ** (2 * H) + Math.abs(k - 1) ** (2 * H));

/**
 * Fractional Brownian motion B_H on [0, T] at n + 1 equally spaced times,
 * exactly in distribution, by Hosking's method (Durbin–Levinson recursion on
 * the fractional Gaussian noise), O(n²). H = ½ is Brownian motion; H < ½ gives
 * rough paths with anti-correlated increments, H > ½ smooth trending ones.
 */
export function fbmPath(seed: number, H: number, n: number, T = 1): number[] {
  const z = normalRng(seed);
  const gamma = Array.from({ length: n }, (_, k) => fgnCovariance(k, H));
  const noise: number[] = [];
  let phi: number[] = [];
  let v = gamma[0];
  noise.push(Math.sqrt(v) * z());
  for (let i = 1; i < n; i++) {
    // Durbin–Levinson: update the partial-autocorrelation coefficients.
    let num = gamma[i];
    for (let j = 0; j < i - 1; j++) num -= phi[j] * gamma[i - 1 - j];
    const k = num / v;
    const next = phi.map((p, j) => p - k * phi[i - 2 - j]);
    next.push(k);
    phi = next;
    v *= 1 - k * k;
    let mean = 0;
    for (let j = 0; j < i; j++) mean += phi[j] * noise[i - 1 - j];
    noise.push(mean + Math.sqrt(v) * z());
  }
  const scale = (T / n) ** H; // self-similarity: increments over Δt have sd Δt^H
  const path = [0];
  for (let i = 0; i < n; i++) path.push(path[i] + scale * noise[i]);
  return path;
}

/**
 * Estimate H from a path by the scaling of its increments:
 * E|X(t + Δ) − X(t)|² ∝ Δ^{2H}, regressing log mean squared increments on log lag.
 */
export function estimateHurst(path: number[], lags = [1, 2, 4, 8, 16]): number {
  const xs: number[] = [], ys: number[] = [];
  for (const L of lags) {
    let s = 0, c = 0;
    for (let i = 0; i + L < path.length; i++) { s += (path[i + L] - path[i]) ** 2; c++; }
    xs.push(Math.log(L));
    ys.push(Math.log(s / c));
  }
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return slope / 2;
}
