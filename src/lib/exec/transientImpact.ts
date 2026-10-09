import { solveLinear } from '../math/linear';

/**
 * Transient impact in a resilient book (Chapter 63), after Obizhaeva and Wang
 * (2013). Above the best ask sits a flat book of depth q shares per dollar.
 * Buying n shares at once eats n/q dollars of the book; the dent D then refills
 * exponentially at rate ρ. A block of n bought when the dent is D costs
 * n (D + n/(2q)) above the undisturbed ask.
 */

/** N + 1 equally spaced trading times 0, T/N, …, T. */
export const tradeTimes = (T: number, N: number) => Array.from({ length: N + 1 }, (_, k) => (k * T) / N);

/** Dent just before each trade. */
export function dentsBefore(trades: number[], times: number[], q: number, rho: number): number[] {
  const out: number[] = [];
  let D = 0;
  for (let k = 0; k < trades.length; k++) {
    if (k > 0) D = (D + trades[k - 1] / q) * Math.exp(-rho * (times[k] - times[k - 1]));
    out.push(D);
  }
  return out;
}

/** Total cost of a schedule above the undisturbed ask, in dollars: Σ n_k (D_k + n_k/(2q)). */
export function scheduleCost(trades: number[], times: number[], q: number, rho: number): number {
  const D = dentsBefore(trades, times, q, rho);
  return trades.reduce((a, n, k) => a + n * (D[k] + n / (2 * q)), 0);
}

/**
 * The cost-minimising schedule on a grid. The cost is ½ nᵀMn/q with
 * M_jk = e^{−ρ|t_j − t_k|}, so under Σn = X the optimum is n ∝ M⁻¹1.
 */
export function optimalSchedule(X: number, times: number[], rho: number): number[] {
  const M = times.map((s) => times.map((t) => Math.exp(-rho * Math.abs(s - t))));
  const y = solveLinear(M, times.map(() => 1));
  const total = y.reduce((a, v) => a + v, 0);
  return y.map((v) => (X * v) / total);
}

export const twapSchedule = (X: number, N: number) => new Array(N + 1).fill(X / (N + 1));
export const blockSchedule = (X: number, N: number) => [X, ...new Array(N).fill(0)];

/**
 * The Obizhaeva–Wang continuous-time solution: equal blocks X/(ρT + 2) at the
 * start and the end, trading at rate ρX/(ρT + 2) in between, which holds the
 * dent constant at X/(q(ρT + 2)). The total cost is X²/(q(ρT + 2)).
 */
export function obizhaevaWang(X: number, T: number, q: number, rho: number) {
  const k = rho * T + 2;
  return { block: X / k, rate: (rho * X) / k, dent: X / (q * k), cost: X ** 2 / (q * k) };
}

/** Cost of buying at a constant rate in continuous time: (X²/(qρT))(1 − (1 − e^{−ρT})/(ρT)). */
export function continuousTwapCost(X: number, T: number, q: number, rho: number): number {
  const a = rho * T;
  if (a < 1e-8) return X ** 2 / (2 * q);
  return (X ** 2 / (q * a)) * (1 - (1 - Math.exp(-a)) / a);
}

/**
 * The dent over time, for plotting: points just before and just after every
 * trade, and the exponential refill in between, until tEnd.
 */
export function dentPath(trades: number[], times: number[], q: number, rho: number, tEnd: number, perStep = 8): [number, number][] {
  const pts: [number, number][] = [];
  const D = dentsBefore(trades, times, q, rho);
  for (let k = 0; k < trades.length; k++) {
    const t0 = times[k], after = D[k] + trades[k] / q;
    pts.push([t0, D[k]], [t0, after]);
    const t1 = k + 1 < times.length ? times[k + 1] : tEnd;
    for (let i = 1; i <= perStep; i++) {
      const t = t0 + ((t1 - t0) * i) / perStep;
      if (k + 1 < times.length && i === perStep) break; // next trade adds its own "before" point
      pts.push([t, after * Math.exp(-rho * (t - t0))]);
    }
  }
  return pts;
}

/* ------------------------------------------------------------------------- */
/* Gatheral's no-dynamic-arbitrage                                            */
/* ------------------------------------------------------------------------- */

/**
 * Round-trip cost of "pump and dump" in a propagator model with impact
 * f(v) = sign(v)|v|^δ and exponential decay G(τ) = e^{−ρτ}: buy X at a
 * constant rate over T₁, then sell X at a constant rate over τ₂. Each phase is
 * cut into small steps; each step pays the price left by earlier steps plus
 * half of its own push. Negative cost = profit from manipulation.
 */
export function pumpAndDump(o: { X: number; T1: number; tau2: number; delta: number; rho: number; steps?: number }): number {
  const { X, T1, tau2, delta, rho, steps = 2000 } = o;
  const f = (v: number) => Math.sign(v) * Math.abs(v) ** delta;
  let P = 0, cost = 0;
  // Each phase gets its own grid, so a very fast dump is still resolved.
  for (const [v, dt] of [[X / T1, T1 / steps], [-X / tau2, tau2 / steps]]) {
    const decay = Math.exp(-rho * dt);
    for (let i = 0; i < steps; i++) {
      const push = f(v) * dt;
      cost += v * dt * (P + push / 2);
      P = (P + push) * decay;
    }
  }
  return cost;
}

/**
 * Price move from trading X in time τ with f(v) = v^δ and a power-law kernel
 * G(τ) = τ^−β: ∫₀^τ (X/τ)^δ (τ − s)^−β ds = X^δ τ^{1−β−δ}/(1 − β). It vanishes
 * for fast trades when β + δ < 1: then a fast dump costs nothing.
 */
export const flashImpact = (X: number, tau: number, delta: number, beta: number) => (X ** delta * tau ** (1 - beta - delta)) / (1 - beta);
