import { normalRng } from '../math/rng';

/**
 * Price discovery across two markets (Chapter 54): the stock and the stock
 * price implied by its options. Both track one efficient price; we measure which
 * one moves first with a vector error-correction model (VECM), Gonzalo–Granger
 * component shares and Hasbrouck information shares.
 */

export interface TwoMarkets {
  /** Efficient price. */
  m: number[];
  /** Stock price. */
  stock: number[];
  /** Stock price implied by options, C − P + K e^{−rT}. */
  option: number[];
}

/**
 * Each market moves part of the way towards the efficient price every step,
 * p_t = p_{t−1} + κ (m_t − p_{t−1}) + η_t: a faster market (larger κ) impounds
 * news sooner. The efficient price is a random walk with step size σ_m.
 */
export function simulateTwoMarkets(o: { n: number; m0: number; sigmaM: number; kStock: number; kOption: number; noise: number; seed: number }): TwoMarkets {
  const z = normalRng(o.seed);
  const m = [o.m0], stock = [o.m0], option = [o.m0];
  for (let t = 1; t <= o.n; t++) {
    m.push(m[t - 1] + o.sigmaM * z());
    stock.push(stock[t - 1] + o.kStock * (m[t] - stock[t - 1]) + o.noise * z());
    option.push(option[t - 1] + o.kOption * (m[t] - option[t - 1]) + o.noise * z());
  }
  return { m, stock, option };
}

/** Least squares β minimising |y − Xβ|², by the normal equations (small problems only). */
export function ols(X: number[][], y: number[]): number[] {
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array<number>(k + 1).fill(0));
  for (let r = 0; r < X.length; r++) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) A[i][j] += X[r][i] * X[r][j];
      A[i][k] += X[r][i] * y[r];
    }
  }
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => row[k] / row[i]);
}

export interface VECM {
  /** Error-correction speeds: how each market responds to the gap p1 − p2. */
  alpha: [number, number];
  /** Covariance matrix of the residuals. */
  omega: [[number, number], [number, number]];
}

/**
 * Fit Δp_i,t = α_i (p1 − p2)_{t−1} + Σ_{j=1..L} (γ_ij Δp1_{t−j} + δ_ij Δp2_{t−j}) + e_i,t
 * equation by equation by least squares.
 */
export function fitVECM(p1: number[], p2: number[], lags = 2): VECM {
  const d1 = p1.slice(1).map((p, i) => p - p1[i]);
  const d2 = p2.slice(1).map((p, i) => p - p2[i]);
  const X: number[][] = [], y1: number[] = [], y2: number[] = [];
  for (let t = lags; t < d1.length; t++) {
    const row = [p1[t] - p2[t]]; // the gap at t−1 for the change d[t] = p[t+1] − p[t]
    for (let j = 1; j <= lags; j++) row.push(d1[t - j], d2[t - j]);
    X.push(row);
    y1.push(d1[t]);
    y2.push(d2[t]);
  }
  const b1 = ols(X, y1), b2 = ols(X, y2);
  const e1 = X.map((x, r) => y1[r] - x.reduce((a, v, i) => a + v * b1[i], 0));
  const e2 = X.map((x, r) => y2[r] - x.reduce((a, v, i) => a + v * b2[i], 0));
  const n = X.length;
  const cov = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0) / n;
  return { alpha: [b1[0], b2[0]], omega: [[cov(e1, e1), cov(e1, e2)], [cov(e1, e2), cov(e2, e2)]] };
}

export interface DiscoveryShares {
  /** Gonzalo–Granger component share of market 1 (market 2 has 1 − this). */
  componentShare: number;
  /** Hasbrouck information share of market 1: lower and upper bounds over the two orderings. */
  infoShareLow: number;
  infoShareHigh: number;
}

/**
 * Both measures use the common-trend weights ψ ∝ α⊥ = (α2, −α1), scaled to sum
 * to one: the component share is ψ1 itself; the information share is the part of
 * the common trend's variance ψΩψᵀ attributed to market 1 after a Cholesky
 * factorisation, which depends on which market is placed first.
 */
export function discoveryShares({ alpha, omega }: VECM): DiscoveryShares {
  const [a1, a2] = alpha;
  const psi = [a2 / (a2 - a1), -a1 / (a2 - a1)];
  const total = psi[0] ** 2 * omega[0][0] + 2 * psi[0] * psi[1] * omega[0][1] + psi[1] ** 2 * omega[1][1];
  // Market 1 first: F = [[√ω11, 0], [ω12/√ω11, √(ω22 − ω12²/ω11)]].
  const f11 = Math.sqrt(omega[0][0]), f21 = omega[0][1] / f11;
  const first = (psi[0] * f11 + psi[1] * f21) ** 2 / total;
  // Market 2 first.
  const g22 = Math.sqrt(omega[1][1]), g12 = omega[0][1] / g22, g11 = Math.sqrt(Math.max(omega[0][0] - g12 * g12, 0));
  const second = (psi[0] * g11) ** 2 / total;
  return { componentShare: psi[0], infoShareLow: Math.min(first, second), infoShareHigh: Math.max(first, second) };
}

/** The stock price implied by put–call parity. */
export function impliedStock(call: number, put: number, K: number, r: number, T: number): number {
  return call - put + K * Math.exp(-r * T);
}
