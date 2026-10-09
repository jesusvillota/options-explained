import { mulberry32 } from '../math/rng';

/**
 * Making markets in many options (Chapter 58).
 *
 * After delta hedging, an options book's main risk is implied volatility.
 * Group options into expiry buckets; the book's inventory is its vega in each
 * bucket, V_j (dollars per volatility point), and bucket volatilities move
 * together with daily covariance Ω (in vol points²). A dealer with risk
 * aversion γ shifts all its quotes in bucket j by d_j = −γ (Ω V)_j vol points.
 */

export const BUCKETS = [
  { label: '1 month', vegaPerContract: 11.5, volOfVol: 1.5 },
  { label: '3 months', vegaPerContract: 19.6, volOfVol: 1.0 },
  { label: '1 year', vegaPerContract: 38, volOfVol: 0.7 },
];

/** Daily covariance of bucket vol moves: vol-of-vol on the diagonal, correlation ρ^|i−j| off it. */
export function volCovariance(rho: number): number[][] {
  return BUCKETS.map((a, i) => BUCKETS.map((b, j) => a.volOfVol * b.volOfVol * Math.pow(rho, Math.abs(i - j))));
}

const matVec = (M: number[][], v: number[]) => M.map((row) => row.reduce((a, m, j) => a + m * v[j], 0));

/** Standard deviation of the book's daily P&L from vol moves, √(Vᵀ Ω V), in dollars. */
export function vegaRisk(V: number[], omega: number[][]): number {
  const OV = matVec(omega, V);
  return Math.sqrt(Math.max(V.reduce((a, v, i) => a + v * OV[i], 0), 0));
}

/** Quote shift per bucket, in vol points: d = −γ Ω V. */
export function quoteShift(V: number[], omega: number[][], gamma: number): number[] {
  return matVec(omega, V).map((x) => -gamma * x);
}

export interface VegaBookParams {
  /** Customer trades per day. */
  trades: number;
  /** Contracts per customer trade. */
  size: number;
  /** Half-spread in vol points. */
  edge: number;
  /** How fast customer interest falls with distance from fair vol (per vol point). */
  k: number;
  gamma: number;
  rho: number;
  seed: number;
}

export interface VegaBookDay {
  /** Vega per bucket after each trade (trades + 1 rows). */
  vega: number[][];
  /** Quote shift per bucket after each trade. */
  shift: number[][];
  /** Edge earned against fair value, dollars. */
  edgeEarned: number;
  /** End-of-day risk √(VᵀΩV), dollars per day. */
  risk: number;
}

/**
 * One day of customer flow: each trade picks a bucket at random; the customer
 * buys at our ask with weight e^{−k(edge + d)} or sells at our bid with weight
 * e^{−k(edge − d)}, where d is our quote shift there. A customer buy leaves us
 * short vega.
 */
export function simulateVegaBook(p: VegaBookParams): VegaBookDay {
  const u = mulberry32(p.seed);
  const omega = volCovariance(p.rho);
  let V = BUCKETS.map(() => 0);
  const vega = [V.slice()], shift = [quoteShift(V, omega, p.gamma)];
  let edgeEarned = 0;
  for (let i = 0; i < p.trades; i++) {
    const j = Math.floor(u() * BUCKETS.length);
    const d = quoteShift(V, omega, p.gamma)[j];
    const wBuy = Math.exp(-p.k * (p.edge + d)), wSell = Math.exp(-p.k * (p.edge - d));
    const customerBuys = u() < wBuy / (wBuy + wSell);
    const vegaTraded = p.size * BUCKETS[j].vegaPerContract;
    // We sell at σ + edge + d (customer buys) or buy at σ − edge + d (customer sells).
    edgeEarned += (customerBuys ? p.edge + d : p.edge - d) * vegaTraded;
    V = V.map((v, k) => (k === j ? v + (customerBuys ? -vegaTraded : vegaTraded) : v));
    vega.push(V.slice());
    shift.push(quoteShift(V, omega, p.gamma));
  }
  return { vega, shift, edgeEarned, risk: vegaRisk(V, omega) };
}

export interface VegaBookStats {
  meanEdge: number;
  /** Root-mean-square end-of-day risk. */
  rmsRisk: number;
  /** Root-mean-square end-of-day vega per bucket. */
  rmsVega: number[];
}

export function vegaBookStats(p: Omit<VegaBookParams, 'seed'>, days: number, seed: number): VegaBookStats {
  let edge = 0, risk2 = 0;
  const v2 = BUCKETS.map(() => 0);
  for (let d = 0; d < days; d++) {
    const day = simulateVegaBook({ ...p, seed: seed + 131 * d });
    edge += day.edgeEarned / days;
    risk2 += day.risk ** 2 / days;
    day.vega[day.vega.length - 1].forEach((v, j) => (v2[j] += (v * v) / days));
  }
  return { meanEdge: edge, rmsRisk: Math.sqrt(risk2), rmsVega: v2.map(Math.sqrt) };
}
