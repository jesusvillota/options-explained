import { mulberry32, normalRng } from '../math/rng';

/**
 * Optimal market making (Chapter 57): Avellaneda and Stoikov (2008), with the
 * Guéant–Lehalle–Fernandez-Tapia (2013) closed-form approximation.
 *
 * The mid-price follows dS = σ dW. The market maker quotes S − δ^b and S + δ^a;
 * market orders hit the ask at rate A e^{−k δ^a} and the bid at rate A e^{−k δ^b}.
 * It maximises E[−exp(−γ (X_T + q_T S_T))], where X is cash and q inventory.
 */

export interface ASParams {
  gamma: number;
  sigma: number;
  k: number;
  A: number;
  T: number;
}

/** Reservation (indifference) price: r = S − q γ σ² (T − t). */
export function reservationPrice(S: number, q: number, t: number, p: ASParams): number {
  return S - q * p.gamma * p.sigma * p.sigma * (p.T - t);
}

/** Total optimal spread δ^a + δ^b = γσ²(T − t) + (2/γ) ln(1 + γ/k). */
export function optimalSpread(t: number, p: ASParams): number {
  return p.gamma * p.sigma * p.sigma * (p.T - t) + (2 / p.gamma) * Math.log(1 + p.gamma / p.k);
}

/** Avellaneda–Stoikov quotes: centred on the reservation price, optimal total spread. */
export function asQuotes(S: number, q: number, t: number, p: ASParams): { bid: number; ask: number; r: number } {
  const r = reservationPrice(S, q, t, p);
  const half = optimalSpread(t, p) / 2;
  return { bid: r - half, ask: r + half, r };
}

/**
 * Guéant–Lehalle–Fernandez-Tapia's asymptotic quotes (far from the horizon):
 *   δ^b(q) ≈ (1/γ) ln(1 + γ/k) + (2q + 1)/2 · ω,   δ^a(q) ≈ (1/γ) ln(1 + γ/k) − (2q − 1)/2 · ω,
 * with ω = √( σ²γ/(2kA) · (1 + γ/k)^{1 + k/γ} ). No dependence on the horizon.
 */
export function glftQuotes(S: number, q: number, p: ASParams): { bid: number; ask: number } {
  const base = Math.log(1 + p.gamma / p.k) / p.gamma;
  const omega = Math.sqrt(((p.sigma * p.sigma * p.gamma) / (2 * p.k * p.A)) * Math.pow(1 + p.gamma / p.k, 1 + p.k / p.gamma));
  return { bid: S - (base + ((2 * q + 1) / 2) * omega), ask: S + (base - ((2 * q - 1) / 2) * omega) };
}

export type Strategy = 'inventory' | 'symmetric';

export interface ASPath {
  t: number[];
  S: number[];
  r: number[];
  bid: number[];
  ask: number[];
  q: number[];
  /** Mark-to-market wealth X + qS. */
  wealth: number[];
}

/**
 * Simulate one run on steps of length dt. The inventory strategy uses the AS
 * quotes; the symmetric strategy uses the same total spread centred on the mid.
 */
export function simulateAS(p: ASParams & { dt: number; s0: number; seed: number; strategy: Strategy }): ASPath {
  const z = normalRng(p.seed), u = mulberry32(p.seed + 1);
  const n = Math.round(p.T / p.dt);
  let S = p.s0, q = 0, X = 0;
  const out: ASPath = { t: [0], S: [S], r: [S], bid: [], ask: [], q: [0], wealth: [0] };
  for (let i = 0; i < n; i++) {
    const t = i * p.dt;
    const qt = p.strategy === 'inventory' ? asQuotes(S, q, t, p) : (() => { const h = optimalSpread(t, p) / 2; return { bid: S - h, ask: S + h, r: S }; })();
    out.bid.push(qt.bid);
    out.ask.push(qt.ask);
    const lamA = p.A * Math.exp(-p.k * (qt.ask - S)), lamB = p.A * Math.exp(-p.k * (S - qt.bid));
    if (u() < lamA * p.dt) { q -= 1; X += qt.ask; }
    if (u() < lamB * p.dt) { q += 1; X -= qt.bid; }
    S += p.sigma * Math.sqrt(p.dt) * z();
    out.t.push(t + p.dt);
    out.S.push(S);
    out.r.push(p.strategy === 'inventory' ? reservationPrice(S, q, t + p.dt, p) : S);
    out.q.push(q);
    out.wealth.push(X + q * S);
  }
  return out;
}

export interface ASStats {
  meanPnl: number;
  sdPnl: number;
  sdInventory: number;
  pnls: number[];
}

export function asStats(p: ASParams & { dt: number; s0: number; strategy: Strategy }, runs: number, seed: number): ASStats {
  const pnls: number[] = [];
  let q2 = 0;
  for (let k = 0; k < runs; k++) {
    const path = simulateAS({ ...p, seed: seed + 101 * k });
    pnls.push(path.wealth[path.wealth.length - 1]);
    q2 += path.q[path.q.length - 1] ** 2;
  }
  const mean = pnls.reduce((a, b) => a + b, 0) / runs;
  const sd = Math.sqrt(pnls.reduce((a, b) => a + (b - mean) ** 2, 0) / (runs - 1));
  return { meanPnl: mean, sdPnl: sd, sdInventory: Math.sqrt(q2 / runs), pnls };
}
