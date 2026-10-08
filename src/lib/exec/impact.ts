import { mulberry32, normalRng } from '../math/rng';

/**
 * Price impact of metaorders (Chapter 61). A metaorder is a large order split
 * into many child orders over hours or days. Sizes are in fractions of daily
 * volume, q = Q / V_day; impacts in the same units as the daily volatility
 * σ_day passed in (basis points in the widgets).
 */

/** The square-root law: I(Q) = Y σ_day √(Q / V_day). */
export function sqrtLawImpact(q: number, sigmaDay: number, Y = 0.7): number {
  return Y * sigmaDay * Math.sqrt(q);
}

/**
 * A latent order book whose hidden liquidity grows like ρ(x) = L x^α with the
 * distance x from the price. Absorbing q needs ∫₀^I L x^α dx = q, so
 * I = ((α + 1) q / L)^{1/(α+1)}. α = 0 is a flat book (linear impact, as in
 * Kyle); α = 1 is the V-shaped book that gives the square-root law.
 * L is calibrated so that every shape gives Y σ √qRef at q = qRef.
 */
export function latentBook(alpha: number, sigmaDay: number, Y = 0.7, qRef = 0.01) {
  const c = (Y * sigmaDay * Math.sqrt(qRef)) / qRef ** (1 / (alpha + 1));
  const L = (alpha + 1) / c ** (alpha + 1);
  return {
    L,
    /** Hidden liquidity per unit of price at distance x (fraction of daily volume per unit). */
    density: (x: number) => L * Math.max(x, 0) ** alpha,
    /** Liquidity hidden between the price and x. */
    cumulative: (x: number) => (L * Math.max(x, 0) ** (alpha + 1)) / (alpha + 1),
    /** Price move needed to absorb q. */
    impact: (q: number) => c * Math.max(q, 0) ** (1 / (alpha + 1)),
  };
}

export interface Metaorder {
  /** Size as a fraction of daily volume. */
  q: number;
  /** Fraction of the day it took. */
  duration: number;
  /** Measured impact: signed price change in the trade's direction, start to end. */
  impact: number;
}

export interface MetaorderSample {
  n: number;
  seed: number;
  /** Shape of the latent book (1 = square root). */
  alpha: number;
  sigmaDay: number;
  /** Fraction of market volume the metaorder takes while it runs. */
  participation: number;
  Y?: number;
  qMin?: number;
  qMax?: number;
  /** Order-to-order spread of the prefactor (log standard deviation). */
  dispersion?: number;
}

/**
 * Synthetic metaorders: log-uniform sizes, executed at a fixed participation
 * rate, so a size-q order runs for q / participation of a day. Measured impact
 * = mechanical impact from the latent book × a random prefactor + the market's
 * own move over the execution, σ_day √duration Z.
 */
export function simulateMetaorders(o: MetaorderSample): Metaorder[] {
  const { n, seed, alpha, sigmaDay, participation, Y = 0.7, qMin = 3e-4, qMax = 0.1, dispersion = 0.3 } = o;
  const u = mulberry32(seed), z = normalRng(seed + 7919);
  const book = latentBook(alpha, sigmaDay, Y);
  const lo = Math.log(qMin), hi = Math.log(qMax);
  const out: Metaorder[] = [];
  for (let i = 0; i < n; i++) {
    const q = Math.exp(lo + (hi - lo) * u());
    const duration = Math.min(q / participation, 1);
    const prefactor = Math.exp(dispersion * z() - 0.5 * dispersion ** 2);
    out.push({ q, duration, impact: book.impact(q) * prefactor + sigmaDay * Math.sqrt(duration) * z() });
  }
  return out;
}

export interface ImpactBin {
  /** Geometric mean size in the bin. */
  q: number;
  mean: number;
  /** Standard error of the mean. */
  se: number;
  n: number;
}

/** Average impact in log-spaced size bins: how the empirical studies present it. */
export function binImpact(orders: Metaorder[], bins = 10, qMin = 3e-4, qMax = 0.1): ImpactBin[] {
  const lo = Math.log(qMin), w = (Math.log(qMax) - lo) / bins;
  const acc = Array.from({ length: bins }, () => ({ s: 0, s2: 0, lq: 0, n: 0 }));
  for (const o of orders) {
    const b = Math.min(Math.max(Math.floor((Math.log(o.q) - lo) / w), 0), bins - 1);
    acc[b].s += o.impact;
    acc[b].s2 += o.impact ** 2;
    acc[b].lq += Math.log(o.q);
    acc[b].n++;
  }
  return acc.filter((a) => a.n > 1).map((a) => {
    const mean = a.s / a.n;
    const variance = Math.max(a.s2 / a.n - mean ** 2, 0) * (a.n / (a.n - 1));
    return { q: Math.exp(a.lq / a.n), mean, se: Math.sqrt(variance / a.n), n: a.n };
  });
}

/**
 * Fit I = A q^δ by least squares on log I against log q, using the bins with
 * positive average impact.
 */
export function fitPowerLaw(bins: { q: number; mean: number }[]): { exponent: number; prefactor: number; used: number } {
  const pts = bins.filter((b) => b.mean > 0).map((b) => [Math.log(b.q), Math.log(b.mean)]);
  const n = pts.length;
  if (n < 2) return { exponent: NaN, prefactor: NaN, used: n };
  const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  const exponent = sxy / sxx;
  return { exponent, prefactor: Math.exp(my - exponent * mx), used: n };
}

/* ------------------------------------------------------------------------- */
/* The propagator model                                                       */
/* ------------------------------------------------------------------------- */

export interface Propagator {
  /** Decay exponent of the transient part: G ∝ (1 + τ/τ₀)^−β. */
  beta: number;
  /** Share of each trade's impact that never decays. */
  permanent: number;
  /** Decay time scale τ₀, in the same units as the time grid. */
  tau0?: number;
}

/** Impact kernel G(τ) per unit of trading, normalised to G(0) = 1. */
export function kernel(tau: number, p: Propagator): number {
  const t0 = p.tau0 ?? 1;
  return (1 - p.permanent) * (1 + Math.max(tau, 0) / t0) ** -p.beta + p.permanent;
}

/**
 * Expected price path of a metaorder that trades one unit per step for
 * `steps` steps and then stops, watched until `horizon`:
 *   I(t) = g Σ_{s < t, s < steps} G(t − s).
 * The scale g is chosen so the peak, at the end of execution, equals `peak`.
 */
export function metaorderPath(p: Propagator, steps: number, horizon: number, peak: number): number[] {
  const raw = (t: number) => {
    let sum = 0;
    for (let s = 0; s < Math.min(t, steps); s++) sum += kernel(t - s - 0.5, p);
    return sum;
  };
  const g = peak / raw(steps);
  return Array.from({ length: horizon + 1 }, (_, t) => g * raw(t));
}

/** Average execution price relative to the start: the mean impact paid over the execution. */
export function averagePaid(path: number[], steps: number): number {
  let sum = 0;
  for (let t = 0; t < steps; t++) sum += (path[t] + path[t + 1]) / 2;
  return sum / steps;
}

/** One noisy price path: the expected impact plus the market's own random walk. */
export function noisyPath(path: number[], noisePerStep: number, seed: number): number[] {
  const z = normalRng(seed);
  let w = 0;
  return path.map((v, t) => {
    if (t > 0) w += noisePerStep * z();
    return v + w;
  });
}
