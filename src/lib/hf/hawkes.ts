import { mulberry32 } from '../math/rng';
import { nelderMead } from '../math/optimize';

/**
 * Order flow as a point process (Chapter 70). A Hawkes process with an
 * exponential kernel has intensity
 *   λ(t) = μ + Σ_{tᵢ < t} α e^{−β(t − tᵢ)}:
 * every event raises the rate of future events by α, decaying at rate β.
 * Each event "gives birth" to α/β further events on average (the branching
 * ratio n); the process is stationary when n < 1, with mean rate μ/(1 − n).
 */

export interface HawkesParams {
  mu: number;
  alpha: number;
  beta: number;
}

export const branchingRatio = (p: HawkesParams) => p.alpha / p.beta;
export const meanIntensity = (p: HawkesParams) => p.mu / (1 - branchingRatio(p));

/** Intensity at time t given the events so far (only events before t count). */
export function intensity(t: number, events: number[], p: HawkesParams): number {
  let s = 0;
  for (const ti of events) {
    if (ti >= t) break;
    s += Math.exp(-p.beta * (t - ti));
  }
  return p.mu + p.alpha * s;
}

/**
 * Ogata's thinning: between events the intensity only decays, so its current
 * value bounds it until the next event. Propose a time from a Poisson process
 * at that bound and accept with probability λ(t)/bound.
 */
export function simulateHawkes(p: HawkesParams, T: number, seed: number): number[] {
  const u = mulberry32(seed);
  const events: number[] = [];
  let t = 0, excite = 0; // excite = Σ α e^{−β(t − tᵢ)} at time t
  while (true) {
    const bound = p.mu + excite;
    const w = -Math.log(1 - u()) / bound;
    excite *= Math.exp(-p.beta * w);
    t += w;
    if (t > T) break;
    if (u() * bound <= p.mu + excite) {
      events.push(t);
      excite += p.alpha;
    }
  }
  return events;
}

/** A homogeneous Poisson process with the given rate. */
export function simulatePoisson(rate: number, T: number, seed: number): number[] {
  const u = mulberry32(seed);
  const events: number[] = [];
  let t = 0;
  while (true) {
    t += -Math.log(1 - u()) / rate;
    if (t > T) return events;
    events.push(t);
  }
}

/**
 * Exact log-likelihood on [0, T]:
 *   Σᵢ log λ(tᵢ) − μT − (α/β) Σᵢ (1 − e^{−β(T − tᵢ)}),
 * using the recursion Aᵢ = e^{−β(tᵢ − tᵢ₋₁)} (1 + Aᵢ₋₁) for Σ_{j<i} e^{−β(tᵢ − tⱼ)}.
 */
export function logLikelihood(events: number[], T: number, p: HawkesParams): number {
  let ll = 0, A = 0;
  for (let i = 0; i < events.length; i++) {
    if (i > 0) A = Math.exp(-p.beta * (events[i] - events[i - 1])) * (1 + A);
    ll += Math.log(p.mu + p.alpha * A);
  }
  ll -= p.mu * T;
  for (const ti of events) ll -= (p.alpha / p.beta) * (1 - Math.exp(-p.beta * (T - ti)));
  return ll;
}

/**
 * Maximum-likelihood fit. Parameters are optimised as log μ, log β and
 * logit(α/β), which keeps μ, β > 0 and the branching ratio in (0, 1).
 */
export function fitHawkes(events: number[], T: number): HawkesParams & { logLik: number } {
  const unpack = (x: number[]): HawkesParams => {
    const mu = Math.exp(x[0]), beta = Math.exp(x[1]), n = 1 / (1 + Math.exp(-x[2]));
    return { mu, alpha: n * beta, beta };
  };
  const rate = events.length / T;
  let best = { x: [Math.log(rate / 2), Math.log(1), 0], fx: Infinity };
  for (const b0 of [0.3, 1, 3]) {
    const r = nelderMead((x) => -logLikelihood(events, T, unpack(x)), [Math.log(rate / 2), Math.log(b0), 0], { step: 0.5, maxIter: 3000 });
    if (r.fx < best.fx) best = r;
  }
  return { ...unpack(best.x), logLik: -best.fx };
}

/** Counts of events in consecutive windows of length w on [0, T]. */
export function windowCounts(events: number[], T: number, w: number): number[] {
  const n = Math.floor(T / w), c = new Array(n).fill(0);
  for (const t of events) {
    const k = Math.floor(t / w);
    if (k < n) c[k]++;
  }
  return c;
}

/** Variance-to-mean ratio of window counts: 1 for Poisson, above 1 when events cluster. */
export function dispersionIndex(counts: number[]): number {
  const m = counts.reduce((a, b) => a + b, 0) / counts.length;
  const v = counts.reduce((a, b) => a + (b - m) ** 2, 0) / (counts.length - 1);
  return v / m;
}
