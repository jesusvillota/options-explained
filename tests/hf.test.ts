import { describe, expect, it } from 'vitest';
import {
  branchingRatio,
  dispersionIndex,
  fitHawkes,
  intensity,
  logLikelihood,
  meanIntensity,
  simulateHawkes,
  simulatePoisson,
  windowCounts,
} from '../src/lib/hf/hawkes';

describe('Chapter 70: Hawkes processes', () => {
  const p = { mu: 0.5, alpha: 1.6, beta: 2 };

  it('branching ratio and mean intensity', () => {
    expect(branchingRatio(p)).toBeCloseTo(0.8, 12);
    expect(meanIntensity(p)).toBeCloseTo(2.5, 12);
  });

  it('intensity jumps by α at an event and decays at rate β', () => {
    const ev = [1];
    expect(intensity(1, ev, p)).toBe(0.5); // events strictly before t
    expect(intensity(1 + 1e-12, ev, p)).toBeCloseTo(2.1, 9);
    expect(intensity(1 + Math.LN2 / 2, ev, p)).toBeCloseTo(0.5 + 0.8, 9);
  });

  it('simulation: seeded, and the long-run rate is μ/(1 − n)', () => {
    expect(simulateHawkes(p, 50, 3)).toEqual(simulateHawkes(p, 50, 3));
    const ev = simulateHawkes(p, 20000, 70);
    expect(ev.length / 20000).toBeCloseTo(2.5, 0);
    expect(Math.abs(ev.length / 20000 - 2.5)).toBeLessThan(0.25);
    const po = simulatePoisson(2.5, 20000, 71);
    expect(po.length / 20000).toBeCloseTo(2.5, 1);
  });

  it('Poisson counts have dispersion 1; Hawkes counts are overdispersed', () => {
    const po = simulatePoisson(2.5, 20000, 5);
    expect(dispersionIndex(windowCounts(po, 20000, 5))).toBeCloseTo(1, 1);
    const ev = simulateHawkes(p, 20000, 5);
    expect(dispersionIndex(windowCounts(ev, 20000, 5))).toBeGreaterThan(5);
    expect(windowCounts([0.5, 1.5, 1.7, 9.9], 10, 2)).toEqual([3, 0, 0, 0, 1]);
  });

  it('log-likelihood: Poisson case is n log μ − μT; matches a direct sum', () => {
    const ev = [0.3, 1.1, 1.2, 4];
    expect(logLikelihood(ev, 5, { mu: 2, alpha: 0, beta: 1 })).toBeCloseTo(4 * Math.log(2) - 10, 12);
    let direct = -p.mu * 5;
    for (const t of ev) {
      direct += Math.log(intensity(t, ev, p));
      direct -= (p.alpha / p.beta) * (1 - Math.exp(-p.beta * (5 - t)));
    }
    expect(logLikelihood(ev, 5, p)).toBeCloseTo(direct, 10);
  });

  it('maximum likelihood recovers the parameters from a long sample', () => {
    const ev = simulateHawkes(p, 4000, 11);
    const f = fitHawkes(ev, 4000);
    expect(f.alpha / f.beta).toBeCloseTo(0.8, 1);
    expect(f.beta).toBeGreaterThan(1.4);
    expect(f.beta).toBeLessThan(2.8);
    expect(f.logLik).toBeGreaterThanOrEqual(logLikelihood(ev, 4000, p));
  });
});
