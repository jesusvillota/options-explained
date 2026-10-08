import { describe, expect, it } from 'vitest';
import {
  averagePaid,
  binImpact,
  fitPowerLaw,
  kernel,
  latentBook,
  metaorderPath,
  noisyPath,
  simulateMetaorders,
  sqrtLawImpact,
} from '../src/lib/exec/impact';
import {
  AC_DEFAULTS,
  costVariance,
  discreteExpectedCost,
  expectedCost,
  frontier,
  halfLife,
  holdings,
  kappa,
  objective,
  schedule,
  simulateShortfall,
  tradingRate,
} from '../src/lib/exec/almgrenChriss';

describe('Chapter 61: price impact', () => {
  it('square-root law: 1% of daily volume with Y = 0.7 and σ = 2% moves the price 14 bp', () => {
    expect(sqrtLawImpact(0.01, 200, 0.7)).toBeCloseTo(14, 10);
    expect(sqrtLawImpact(0.04, 200, 0.7)).toBeCloseTo(28, 10);
  });

  it('latent book: impact exponent is 1/(α + 1), calibrated to the square-root law at 1%', () => {
    for (const alpha of [0, 0.5, 1, 2]) expect(latentBook(alpha, 200).impact(0.01)).toBeCloseTo(14, 10);
    expect(latentBook(1, 200).impact(0.04)).toBeCloseTo(28, 10);
    expect(latentBook(0, 200).impact(0.02)).toBeCloseTo(28, 10);
    expect(latentBook(2, 200).impact(0.08)).toBeCloseTo(28, 10);
  });

  it('latent book: the liquidity between the price and the impact equals the order size', () => {
    for (const alpha of [0, 1, 1.7]) {
      const b = latentBook(alpha, 200);
      for (const q of [0.001, 0.02, 0.05]) expect(b.cumulative(b.impact(q))).toBeCloseTo(q, 12);
    }
    // V-shaped book: ρ(x) = L x with L = 2 / c², c = 140 bp.
    const v = latentBook(1, 200);
    expect(v.L).toBeCloseTo(2 / 140 ** 2, 15);
    expect(v.density(10)).toBeCloseTo((2 / 140 ** 2) * 10, 15);
  });

  it('binning: means and standard errors', () => {
    const orders = [
      { q: 0.001, duration: 0, impact: 1 },
      { q: 0.001, duration: 0, impact: 3 },
      { q: 0.05, duration: 0, impact: 10 },
      { q: 0.05, duration: 0, impact: 14 },
    ];
    const bins = binImpact(orders, 2, 1e-4, 0.1);
    expect(bins).toHaveLength(2);
    expect(bins[0].mean).toBe(2);
    expect(bins[0].se).toBeCloseTo(1, 12); // sample sd √2, over √2
    expect(bins[1].mean).toBe(12);
    expect(bins[1].q).toBeCloseTo(0.05, 12);
  });

  it('power-law fit recovers exact exponents and prefactors', () => {
    const bins = [1e-3, 3e-3, 1e-2, 3e-2].map((q) => ({ q, mean: 140 * q ** 0.5 }));
    const f = fitPowerLaw(bins);
    expect(f.exponent).toBeCloseTo(0.5, 12);
    expect(f.prefactor).toBeCloseTo(140, 9);
    expect(fitPowerLaw([...bins, { q: 0.05, mean: -1 }]).used).toBe(4);
  });

  it('simulated metaorders reproduce the book shape’s exponent', () => {
    for (const [alpha, target] of [[1, 0.5], [0, 1], [2, 1 / 3]]) {
      const orders = simulateMetaorders({ n: 100000, seed: 61, alpha, sigmaDay: 200, participation: 0.1 });
      expect(fitPowerLaw(binImpact(orders)).exponent).toBeCloseTo(target, 1);
    }
  });

  it('simulation is seeded and executes at the participation rate', () => {
    const a = simulateMetaorders({ n: 50, seed: 3, alpha: 1, sigmaDay: 200, participation: 0.1 });
    const b = simulateMetaorders({ n: 50, seed: 3, alpha: 1, sigmaDay: 200, participation: 0.1 });
    expect(a).toEqual(b);
    for (const o of a) expect(o.duration).toBeCloseTo(Math.min(o.q / 0.1, 1), 12);
  });

  it('propagator kernel decays as a power law to the permanent floor', () => {
    expect(kernel(0, { beta: 0.5, permanent: 0.1 })).toBeCloseTo(1, 12);
    expect(kernel(3, { beta: 0.5, permanent: 0 })).toBeCloseTo(0.5, 12);
    expect(kernel(1e12, { beta: 0.5, permanent: 0.1 })).toBeCloseTo(0.1, 5);
  });

  it('a permanent kernel gives linear growth and no decay; average paid is half the peak', () => {
    const p = metaorderPath({ beta: 0, permanent: 0 }, 60, 180, 30);
    expect(p[30]).toBeCloseTo(15, 10);
    expect(p[60]).toBeCloseTo(30, 10);
    expect(p[180]).toBeCloseTo(30, 10);
    expect(averagePaid(p, 60)).toBeCloseTo(15, 10);
  });

  it('power-law kernel: concave growth, peak when buying stops, then decay', () => {
    const p = metaorderPath({ beta: 0.5, permanent: 0 }, 60, 180, 30);
    expect(p[60]).toBeCloseTo(30, 10);
    expect(Math.max(...p)).toBeCloseTo(30, 10);
    // Close to the continuum √(t/T) shape: √½ ≈ 0.71 of the peak halfway.
    expect(p[30] / 30).toBeGreaterThan(0.64);
    expect(p[30] / 30).toBeLessThan(0.72);
    for (let t = 61; t <= 180; t++) expect(p[t]).toBeLessThan(p[t - 1]);
    // A permanent floor slows the decay.
    const q = metaorderPath({ beta: 0.5, permanent: 0.1 }, 60, 180, 30);
    expect(q[120]).toBeGreaterThan(p[120]);
    expect(q[120] / 30).toBeCloseTo(0.64, 1);
  });

  it('noisy paths are seeded and reduce to the expected path without noise', () => {
    const p = metaorderPath({ beta: 0.5, permanent: 0.1 }, 60, 180, 30);
    expect(noisyPath(p, 0, 1)).toEqual(p);
    expect(noisyPath(p, 5, 9)).toEqual(noisyPath(p, 5, 9));
  });
});

describe('Chapter 62: Almgren–Chriss', () => {
  const p = AC_DEFAULTS;
  const integrate = (f: (t: number) => number, T: number, n = 20000) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += f(((i + 0.5) * T) / n);
    return (s * T) / n;
  };

  it('TWAP limit: E = ½λX² + ηX²/T = $350,000 and Var = σ²X²T/3', () => {
    const twap = { ...p, gamma: 0 };
    expect(expectedCost(twap)).toBeCloseTo(350000, 6);
    expect(costVariance(twap)).toBeCloseTo((4 * 1e12) / 3, -3);
    expect(holdings(twap, 0.25)).toBeCloseTo(750000, 6);
  });

  it('κ = √(γσ²/η) and the sinh trajectory hits its endpoints', () => {
    expect(kappa(p)).toBeCloseTo(Math.sqrt(4 / 3), 12);
    expect(holdings(p, 0)).toBeCloseTo(p.X, 6);
    expect(holdings(p, p.T)).toBeCloseTo(0, 6);
    expect(holdings(p, 0.5)).toBeCloseTo((p.X * Math.sinh(kappa(p) * 0.5)) / Math.sinh(kappa(p)), 6);
  });

  it('closed forms match numerical integrals of η∫ẋ² and σ²∫x²', () => {
    for (const gamma of [1e-8, 1e-7, 1e-6, 1e-5]) {
      const q = { ...p, gamma };
      const E = 0.5 * q.lambda * q.X ** 2 + q.eta * integrate((t) => tradingRate(q, t) ** 2, q.T);
      const V = q.sigma ** 2 * integrate((t) => holdings(q, t) ** 2, q.T);
      expect(expectedCost(q) / E).toBeCloseTo(1, 6);
      expect(costVariance(q) / V).toBeCloseTo(1, 6);
    }
  });

  it('the sinh trajectory beats perturbed trajectories on E + γ Var', () => {
    const q = { ...p, gamma: 1e-6 };
    const best = objective(q);
    for (const eps of [-0.05, 0.05, 0.2]) {
      // x_t + ε X sin(πt/T): same endpoints.
      const x = (t: number) => holdings(q, t) + eps * q.X * Math.sin(Math.PI * t);
      const v = (t: number) => tradingRate(q, t) - eps * q.X * Math.PI * Math.cos(Math.PI * t);
      const obj = 0.5 * q.lambda * q.X ** 2 + q.eta * integrate((t) => v(t) ** 2, 1) + q.gamma * q.sigma ** 2 * integrate((t) => x(t) ** 2, 1);
      expect(obj).toBeGreaterThan(best);
    }
  });

  it('efficient frontier: more risk aversion costs more and risks less; flat at TWAP', () => {
    const f = frontier(p, [0, 1e-9, 1e-8, 1e-7, 1e-6, 1e-5]);
    for (let i = 1; i < f.length; i++) {
      expect(f[i].mean).toBeGreaterThanOrEqual(f[i - 1].mean - 1e-6);
      expect(f[i].sd).toBeLessThan(f[i - 1].sd);
    }
    // First-order free risk reduction: tiny γ cuts variance much more than it adds cost.
    const dE = f[2].mean - f[0].mean, dSd = f[0].sd - f[2].sd;
    // Along the frontier dE/dsd = −2γ·sd, so near γ = 0 the slope vanishes.
    expect(dE / dSd).toBeLessThan(0.02);
  });

  it('half-life tends to ln 2 / κ for urgent sellers', () => {
    const q = { ...p, gamma: 1e-4 };
    expect(halfLife(q) * kappa(q)).toBeCloseTo(Math.LN2, 4);
    expect(halfLife({ ...p, gamma: 0 })).toBeCloseTo(0.5, 6);
  });

  it('simulated shortfall matches the discrete mean and variance', () => {
    const q = { ...p, gamma: 1e-6 };
    const n = schedule(q, 78);
    expect(n.reduce((a, b) => a + b, 0)).toBeCloseTo(q.X, 4);
    const costs = simulateShortfall(q, n, 20000, 62);
    const m = costs.reduce((a, b) => a + b, 0) / costs.length;
    const sd = Math.sqrt(costs.reduce((a, b) => a + (b - m) ** 2, 0) / costs.length);
    const tau = q.T / 78;
    let left = q.X, v = 0;
    for (const k of n) {
      left -= k;
      v += q.sigma ** 2 * tau * left ** 2;
    }
    expect(Math.abs(m - discreteExpectedCost(q, n))).toBeLessThan((4 * Math.sqrt(v)) / Math.sqrt(costs.length));
    expect(sd / Math.sqrt(v)).toBeCloseTo(1, 1);
    // Fine slicing: the discrete cost approaches the continuous formula.
    expect(discreteExpectedCost(q, n) / expectedCost(q)).toBeCloseTo(1, 1);
    expect(simulateShortfall(q, n, 5, 1)).toEqual(simulateShortfall(q, n, 5, 1));
  });
});
