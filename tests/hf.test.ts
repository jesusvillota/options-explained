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
import { fitThroughOrigin, imbalance, queueMicroprice, raceShare, simulateOfi, simulateRace, upProbability, upProbabilityGrid, weightedMid } from '../src/lib/hf/queues';

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

describe('Chapter 71: queues and imbalance', () => {
  it('boundary values, symmetry and monotonicity', () => {
    const P = upProbabilityGrid(30, 1);
    expect(P[0][5]).toBe(0);
    expect(P[5][0]).toBe(1);
    for (const [x, y] of [[3, 7], [10, 2], [1, 20]]) expect(P[x][y] + P[y][x]).toBeCloseTo(1, 6);
    expect(P[8][8]).toBeCloseTo(0.5, 6);
    expect(P[10][5]).toBeGreaterThan(P[9][5]);
    expect(P[10][5]).toBeLessThan(P[10][4]);
  });

  it('the chain equation holds at interior points', () => {
    const P = upProbabilityGrid(30, 0.8);
    const lam = 0.8 / 1.8, mu = 1 / 1.8;
    const rhs = (lam * P[6][4] + mu * P[4][4] + lam * P[5][5] + mu * P[5][3]) / (2 * lam + 2 * mu);
    expect(P[5][4]).toBeCloseTo(rhs, 8);
  });

  it('simulated races agree with the solved probabilities', () => {
    expect(Math.abs(raceShare(10, 5, 1, 4000, 1) - upProbability(10, 5, 1))).toBeLessThan(0.03);
    expect(Math.abs(raceShare(2, 10, 0.8, 4000, 2) - upProbability(2, 10, 0.8))).toBeLessThan(0.03);
    const r = simulateRace(3, 4, 1, 9);
    const last = r.path[r.path.length - 1];
    expect(Math.min(...last)).toBe(0);
    expect(r.up).toBe(last[1] === 0);
  });

  it('imbalance, weighted mid and the expected next mid', () => {
    expect(imbalance(30, 10)).toBe(0.75);
    expect(weightedMid(100, 100.02, 30, 10)).toBeCloseTo(100.015, 12);
    expect(queueMicroprice(100.005, 0.01, 0.5)).toBeCloseTo(100.005, 12);
    expect(queueMicroprice(100.005, 0.01, 0.75)).toBeCloseTo(100.01, 12);
  });

  it('order-flow imbalance explains mid changes, with a slope that falls with depth', () => {
    const a = simulateOfi({ intervals: 2000, eventsPerInterval: 50, ratio: 1, depth: 5, seed: 71 });
    const b = simulateOfi({ intervals: 2000, eventsPerInterval: 50, ratio: 1, depth: 20, seed: 71 });
    const fa = fitThroughOrigin(a.ofi, a.dmid), fb = fitThroughOrigin(b.ofi, b.dmid);
    expect(fa.slope).toBeGreaterThan(0);
    expect(fa.r2).toBeGreaterThan(0.2);
    expect(fa.slope).toBeGreaterThan(2 * fb.slope);
    expect(fitThroughOrigin([1, 2, 3], [2, 4, 6])).toEqual({ slope: 2, r2: 1 });
  });
});
