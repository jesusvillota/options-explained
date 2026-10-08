import { normalRng } from '../math/rng';

/**
 * Almgren–Chriss optimal execution (Chapter 62). Sell X shares by time T.
 * The unaffected price is arithmetic Brownian motion with volatility σ (dollars
 * per share per √day). Selling at rate v = −ẋ has a temporary cost η v per share
 * and moves the price permanently by λ per share sold. The implementation
 * shortfall C (dollars, relative to X S₀) has
 *   E[C] = ½ λ X² + η ∫ ẋ² dt,   Var[C] = σ² ∫ x² dt,
 * and minimising E[C] + γ Var[C] gives x_t = X sinh(κ(T − t)) / sinh(κT),
 * with κ = √(γσ²/η).
 */

export interface ACParams {
  /** Shares to sell. */
  X: number;
  /** Horizon, in days. */
  T: number;
  /** Price volatility, dollars per share per √day. */
  sigma: number;
  /** Temporary impact: dollars per share per (share per day) of trading rate. */
  eta: number;
  /** Permanent impact: dollars per share per share sold. */
  lambda: number;
  /** Risk aversion, per dollar. */
  gamma: number;
}

/** Default example: sell 1 million shares of a $100 stock (2% daily volatility) over one day. */
export const AC_DEFAULTS: ACParams = { X: 1e6, T: 1, sigma: 2, eta: 3e-7, lambda: 1e-7, gamma: 1e-7 };

export const kappa = (p: ACParams) => Math.sqrt((p.gamma * p.sigma ** 2) / p.eta);

const SMALL = 1e-6;

/** Holdings at time t. κ → 0 gives the straight line of TWAP. */
export function holdings(p: ACParams, t: number): number {
  const k = kappa(p), s = Math.min(Math.max(t, 0), p.T);
  if (k * p.T < SMALL) return p.X * (1 - s / p.T);
  return (p.X * Math.sinh(k * (p.T - s))) / Math.sinh(k * p.T);
}

/** Selling rate at time t, shares per day. */
export function tradingRate(p: ACParams, t: number): number {
  const k = kappa(p), s = Math.min(Math.max(t, 0), p.T);
  if (k * p.T < SMALL) return p.X / p.T;
  return (p.X * k * Math.cosh(k * (p.T - s))) / Math.sinh(k * p.T);
}

/** Expected shortfall E[C] = ½λX² + η∫ẋ²dt, in closed form. */
export function expectedCost(p: ACParams): number {
  const k = kappa(p), { X, T, eta, lambda } = p;
  const permanent = 0.5 * lambda * X ** 2;
  if (k * T < SMALL) return permanent + (eta * X ** 2) / T;
  // ∫₀ᵀ cosh²(κs) ds = T/2 + sinh(2κT)/(4κ)
  return permanent + ((eta * X ** 2 * k ** 2) / Math.sinh(k * T) ** 2) * (T / 2 + Math.sinh(2 * k * T) / (4 * k));
}

/** Variance of the shortfall, σ²∫x²dt, in closed form. */
export function costVariance(p: ACParams): number {
  const k = kappa(p), { X, T, sigma } = p;
  if (k * T < SMALL) return (sigma ** 2 * X ** 2 * T) / 3;
  // ∫₀ᵀ sinh²(κs) ds = sinh(2κT)/(4κ) − T/2
  return ((sigma ** 2 * X ** 2) / Math.sinh(k * T) ** 2) * (Math.sinh(2 * k * T) / (4 * k) - T / 2);
}

/** The mean–variance objective the strategy minimises. */
export const objective = (p: ACParams) => expectedCost(p) + p.gamma * costVariance(p);

/** Points (standard deviation, expected cost) of the efficient frontier, one per risk aversion. */
export function frontier(p: ACParams, gammas: number[]): { gamma: number; sd: number; mean: number }[] {
  return gammas.map((gamma) => {
    const q = { ...p, gamma };
    return { gamma, sd: Math.sqrt(costVariance(q)), mean: expectedCost(q) };
  });
}

/** Time for the position to halve, in the same units as T. */
export function halfLife(p: ACParams): number {
  const target = p.X / 2;
  let lo = 0, hi = p.T;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (holdings(p, mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Shares sold in each of N equal intervals, following the continuous trajectory. */
export function schedule(p: ACParams, N: number): number[] {
  return Array.from({ length: N }, (_, k) => holdings(p, (k * p.T) / N) - holdings(p, ((k + 1) * p.T) / N));
}

/**
 * Simulate the shortfall of a schedule. In interval k the seller sells n_k at
 * S_{k−1} − η n_k/τ; then the price moves by σ√τ Z_k − λ n_k.
 * C = Σ n_k (S₀ − execution price).
 */
export function simulateShortfall(p: ACParams, trades: number[], paths: number, seed: number): number[] {
  const N = trades.length, tau = p.T / N, z = normalRng(seed);
  const out: number[] = [];
  for (let i = 0; i < paths; i++) {
    let drift = 0; // S_{k−1} − S₀
    let cost = 0;
    for (let k = 0; k < N; k++) {
      const n = trades[k];
      cost += n * ((p.eta * n) / tau - drift);
      drift += p.sigma * Math.sqrt(tau) * z() - p.lambda * n;
    }
    out.push(cost);
  }
  return out;
}

/** Expected shortfall of a discrete schedule: ½λ(X² − Σn²) + (η/τ)Σn². */
export function discreteExpectedCost(p: ACParams, trades: number[]): number {
  const tau = p.T / trades.length;
  const X = trades.reduce((a, n) => a + n, 0), sq = trades.reduce((a, n) => a + n * n, 0);
  return 0.5 * p.lambda * (X ** 2 - sq) + (p.eta / tau) * sq;
}
