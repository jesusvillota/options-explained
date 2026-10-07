import { describe, expect, it } from 'vitest';
import { brownianPath, itoSquareSums, runningQuadraticVariation, runningTotalVariation, scaledRandomWalk } from '../src/lib/math/brownian';
import { interpolate, solveBlackScholesPDE } from '../src/lib/numerics/finiteDifference';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';

describe('Brownian motion', () => {
  it('has variance t at time t across many paths', () => {
    let sumSq = 0;
    const N = 4000;
    for (let s = 0; s < N; s++) sumSq += brownianPath(s, 16, 1)[16] ** 2;
    expect(sumSq / N).toBeCloseTo(1, 1);
  });

  it('has quadratic variation t and exploding total variation', () => {
    const fine = brownianPath(1, 20000, 1);
    expect(runningQuadraticVariation(fine)[20000]).toBeCloseTo(1, 1);
    const coarse = brownianPath(1, 100, 1);
    expect(runningTotalVariation(fine)[20000]).toBeGreaterThan(5 * runningTotalVariation(coarse)[100]);
  });

  it('makes the scaled random walk end with variance 1', () => {
    let sumSq = 0;
    for (let s = 0; s < 3000; s++) sumSq += scaledRandomWalk(s, 64)[64] ** 2;
    expect(sumSq / 3000).toBeCloseTo(1, 1);
  });

  it('obeys Itô: W² = ∫2W dW + t (corrected sum tracks W², naive falls behind)', () => {
    const W = brownianPath(5, 50000, 1);
    const { naive, corrected } = itoSquareSums(W, 1);
    expect(corrected[50000]).toBeCloseTo(W[50000] ** 2, 1);
    expect(W[50000] ** 2 - naive[50000]).toBeCloseTo(1, 1);
  });
});

describe('Black–Scholes PDE by finite differences', () => {
  it('reproduces the formula with Crank–Nicolson', () => {
    const fd = solveBlackScholesPDE({ type: 'call', K: 100, r: 0.05, sigma: 0.2, T: 1, nS: 400, nT: 200 });
    const v = interpolate(fd.S, fd.V[200], 100);
    expect(v).toBeCloseTo(price('call', DEFAULTS), 2);
    const put = solveBlackScholesPDE({ type: 'put', K: 100, r: 0.05, sigma: 0.2, T: 1, nS: 400, nT: 200 });
    expect(interpolate(put.S, put.V[200], 90)).toBeCloseTo(price('put', { ...DEFAULTS, S: 90 }), 2);
  });

  it('prices the American put with the early-exercise max', () => {
    const fd = solveBlackScholesPDE({ type: 'put', K: 100, r: 0.05, sigma: 0.2, T: 1, nS: 400, nT: 400, american: true });
    expect(interpolate(fd.S, fd.V[400], 100)).toBeCloseTo(6.09, 1);
  });
});
