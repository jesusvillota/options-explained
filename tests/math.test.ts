import { describe, expect, it } from 'vitest';
import { cdf, invCdf, pdf } from '../src/lib/math/normal';
import { brownianBridge, mulberry32, normalRng } from '../src/lib/math/rng';
import { bisection, newton } from '../src/lib/math/rootFind';

describe('normal distribution', () => {
  it('matches reference CDF values', () => {
    expect(cdf(0)).toBe(0.5);
    expect(cdf(1.96)).toBeCloseTo(0.9750021048517795, 14);
    expect(cdf(-1)).toBeCloseTo(0.15865525393145707, 14);
    expect(cdf(3)).toBeCloseTo(0.9986501019683699, 14);
    // deep tail: check relative error
    expect(Math.abs(cdf(-8) / 6.22096057427178e-16 - 1)).toBeLessThan(1e-7);
  });

  it('is symmetric: N(x) + N(−x) = 1', () => {
    for (const x of [0.1, 0.7, 1.3, 2.5, 5]) expect(cdf(x) + cdf(-x)).toBeCloseTo(1, 15);
  });

  it('has the right density', () => {
    expect(pdf(0)).toBeCloseTo(0.3989422804014327, 15);
  });

  it('inverts the CDF', () => {
    // Upper-tail points lose precision in 1 − tail, so round-trip through the lower tail.
    for (const x of [-6, -5, -2, -0.3, 0, 0.8, 2.2]) expect(invCdf(cdf(x))).toBeCloseTo(x, 9);
    expect(invCdf(1 - cdf(-6))).toBeCloseTo(6, 6);
    expect(invCdf(0.975)).toBeCloseTo(1.959963984540054, 12);
  });
});

describe('seeded random numbers', () => {
  it('are reproducible', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it('give standard normal draws', () => {
    const z = normalRng(7);
    const n = 200_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = z();
      sum += x;
      sumSq += x * x;
    }
    expect(sum / n).toBeCloseTo(0, 2);
    expect(sumSq / n).toBeCloseTo(1, 1);
  });

  it('build a Brownian bridge pinned at both ends', () => {
    const b = brownianBridge(3, 100);
    expect(b).toHaveLength(101);
    expect(b[0]).toBe(0);
    expect(b[100]).toBeCloseTo(0, 12);
  });
});

describe('root finding', () => {
  const f = (x: number) => x * x - 2;
  it('bisection finds √2', () => expect(bisection(f, 0, 2)).toBeCloseTo(Math.SQRT2, 10));
  it('newton finds √2', () => expect(newton(f, (x) => 2 * x, 1)).toBeCloseTo(Math.SQRT2, 12));
  it('bisection rejects an unbracketed root', () => expect(() => bisection(f, 2, 3)).toThrow());
});
