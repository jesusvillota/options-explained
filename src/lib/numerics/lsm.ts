import { normalRng } from '../math/rng';

/**
 * Longstaff–Schwartz (2001) least-squares Monte Carlo for an American put
 * under GBM (Chapter 36). At each exercise date, working backwards, regress the
 * discounted future cash flows of in-the-money paths on 1, x, x² (x = S/K),
 * and exercise where the immediate payoff beats the fitted continuation value.
 */
export interface LSMInput {
  S: number;
  K: number;
  T: number;
  r: number;
  sigma: number;
  /** Number of exercise dates. */
  steps: number;
  /** Number of paths (antithetic pairs are used, so this is rounded to even). */
  paths: number;
  seed: number;
}

export interface LSMSnapshot {
  /** Time of this exercise date. */
  t: number;
  /** In-the-money stock prices and the discounted continuation cash flows realised along each path. */
  S: number[];
  Y: number[];
  /** Regression coefficients on 1, x, x² with x = S/K. */
  beta: [number, number, number];
  /** Stock price below which exercise is optimal (NaN if never). */
  boundary: number;
}

export interface LSMResult {
  price: number;
  stdError: number;
  /** European put from the same paths, for comparison. */
  european: number;
  snapshots: LSMSnapshot[];
}

/** Solve the 3×3 normal equations for a quadratic least-squares fit. */
function quadFit(x: number[], y: number[]): [number, number, number] {
  const s = new Array(5).fill(0), t = [0, 0, 0];
  for (let i = 0; i < x.length; i++) {
    let p = 1;
    for (let k = 0; k < 5; k++) { s[k] += p; if (k < 3) t[k] += p * y[i]; p *= x[i]; }
  }
  const M = [[s[0], s[1], s[2]], [s[1], s[2], s[3]], [s[2], s[3], s[4]]];
  // Cramer's rule is fine for a well-conditioned 3×3 system on x = S/K ≈ 1.
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-14) return [y.reduce((a, b) => a + b, 0) / Math.max(y.length, 1), 0, 0];
  const col = (j: number) => M.map((row, i) => row.map((v, k) => (k === j ? t[i] : v)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}

export function longstaffSchwartz({ S, K, T, r, sigma, steps, paths, seed }: LSMInput): LSMResult {
  const z = normalRng(seed);
  const n = Math.max(2, paths - (paths % 2));
  const dt = T / steps, disc = Math.exp(-r * dt);
  const drift = (r - 0.5 * sigma * sigma) * dt, vol = sigma * Math.sqrt(dt);
  // Antithetic paths: rows 2j and 2j+1 use ±Z.
  const grid: Float64Array[] = Array.from({ length: n }, () => new Float64Array(steps + 1));
  for (let j = 0; j < n; j += 2) {
    grid[j][0] = S; grid[j + 1][0] = S;
    for (let i = 1; i <= steps; i++) {
      const x = z();
      grid[j][i] = grid[j][i - 1] * Math.exp(drift + vol * x);
      grid[j + 1][i] = grid[j + 1][i - 1] * Math.exp(drift - vol * x);
    }
  }
  const put = (s: number) => Math.max(K - s, 0);
  // cash[j]: cash flow of path j, valued at the current date in the backward sweep.
  const cash = grid.map((p) => put(p[steps]));
  const european = (Math.exp(-r * T) * cash.reduce((a, b) => a + b, 0)) / n;
  const snapshots: LSMSnapshot[] = [];
  for (let i = steps - 1; i >= 1; i--) {
    for (let j = 0; j < n; j++) cash[j] *= disc;
    const itm = [] as number[];
    for (let j = 0; j < n; j++) if (grid[j][i] < K) itm.push(j);
    const Sx = itm.map((j) => grid[j][i]);
    const Y = itm.map((j) => cash[j]);
    const beta = quadFit(Sx.map((s) => s / K), Y);
    const cont = (s: number) => beta[0] + beta[1] * (s / K) + beta[2] * (s / K) ** 2;
    for (const j of itm) if (put(grid[j][i]) > cont(grid[j][i])) cash[j] = put(grid[j][i]);
    // The boundary: scanning down from the strike, within the range of the data, the first
    // price where exercising beats the fitted continuation value; then refine by bisection.
    const gain = (s: number) => put(s) - cont(s);
    const sMin = Sx.length ? Math.min(...Sx) : K;
    let boundary = NaN;
    const grid0 = 200;
    for (let g = 1; g <= grid0; g++) {
      const s = K - ((K - sMin) * g) / grid0;
      if (gain(s) > 0) {
        let lo = s, hi = s + (K - sMin) / grid0;
        for (let it = 0; it < 40; it++) { const mid = 0.5 * (lo + hi); if (gain(mid) > 0) lo = mid; else hi = mid; }
        boundary = lo;
        break;
      }
    }
    snapshots.push({ t: i * dt, S: Sx, Y, beta, boundary });
  }
  // Discount from the first exercise date to today; no exercise at t = 0 unless immediately optimal.
  const values = cash.map((v) => v * disc);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  // Antithetic pairs are dependent, so the standard error uses pair averages.
  const pairs = Array.from({ length: n / 2 }, (_, j) => 0.5 * (values[2 * j] + values[2 * j + 1]));
  const pm = pairs.reduce((a, b) => a + b, 0) / pairs.length;
  const se = Math.sqrt(pairs.reduce((a, b) => a + (b - pm) ** 2, 0) / (pairs.length - 1) / pairs.length);
  return { price: Math.max(mean, put(S)), stdError: se, european, snapshots: snapshots.reverse() };
}
