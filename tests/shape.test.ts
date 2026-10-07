import { describe, expect, it } from 'vitest';
import { cdf } from '../src/lib/math/normal';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import { butterflyProbabilities, shapeViolations } from '../src/lib/pricing/shape';

const strikes = [70, 80, 90, 100, 110, 120, 130];
const bs = strikes.map((K) => ({ K, C: price('call', { ...DEFAULTS, K }) }));

describe('shape constraints', () => {
  it('accept a Black–Scholes strip', () => {
    expect(shapeViolations(bs, DEFAULTS.r, DEFAULTS.T)).toEqual([]);
  });

  it('catch an increasing pair', () => {
    const bad = bs.map((q) => (q.K === 100 ? { ...q, C: 17 } : q));
    const v = shapeViolations(bad, DEFAULTS.r, DEFAULTS.T);
    expect(v.some((x) => x.kind === 'increasing' && x.strikes.join() === '90,100')).toBe(true);
  });

  it('catch a dent (non-convex) and price the butterfly', () => {
    const bad = bs.map((q) => (q.K === 100 ? { ...q, C: 12 } : q));
    const v = shapeViolations(bad, DEFAULTS.r, DEFAULTS.T).find((x) => x.kind === 'not-convex' && x.strikes.join() === '90,100,110')!;
    const c90 = bs[2].C, c110 = bs[4].C;
    expect(v.profitToday).toBeCloseTo(12 - 0.5 * (c90 + c110), 10);
  });

  it('catch a drop steeper than the discounted strike gap', () => {
    const bad = bs.map((q) => (q.K === 80 ? { ...q, C: 40 } : q));
    expect(shapeViolations(bad, DEFAULTS.r, DEFAULTS.T).some((x) => x.kind === 'too-steep')).toBe(true);
  });
});

describe('probabilities from butterflies', () => {
  it('are positive and approximate the lognormal mass near each strike', () => {
    const fine = Array.from({ length: 121 }, (_, i) => 40 + i).map((K) => ({ K, C: price('call', { ...DEFAULTS, K }) }));
    const probs = butterflyProbabilities(fine, DEFAULTS.r, DEFAULTS.T);
    expect(probs.every((p) => p.p > 0)).toBe(true);
    // Total mass between 41 and 159 ≈ Q(41 − 0.5 < S_T < 159 + 0.5) under the lognormal.
    const total = probs.reduce((s, p) => s + p.p, 0);
    const { S, r, sigma, T } = DEFAULTS;
    const z = (x: number) => (Math.log(x / S) - (r - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    expect(total).toBeCloseTo(cdf(z(159.5)) - cdf(z(40.5)), 2);
  });
});
