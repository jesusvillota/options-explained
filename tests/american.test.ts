import { describe, expect, it } from 'vitest';
import { gbmPath } from '../src/lib/math/rng';
import { perpetualPut, perpetualPutBoundary } from '../src/lib/pricing/american';
import { binomialPrice, exerciseBoundary } from '../src/lib/pricing/binomial';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';

describe('early exercise boundary', () => {
  const put = exerciseBoundary('put', { ...DEFAULTS, steps: 300, american: true }, 10);

  it('starts below the strike and rises to it at expiry', () => {
    expect(put[0].S!).toBeLessThan(DEFAULTS.K);
    expect(put[0].S!).toBeGreaterThan(70);
    expect(put[put.length - 1].S).toBe(DEFAULTS.K);
    // Roughly increasing towards expiry.
    expect(put[9].S!).toBeGreaterThan(put[0].S!);
  });

  it('agrees with the binomial price: exercising at the boundary is worth the payoff', () => {
    const b = put[0].S!;
    const am = binomialPrice('put', { ...DEFAULTS, S: b * 0.98, steps: 300, american: true });
    expect(am).toBeCloseTo(DEFAULTS.K - b * 0.98, 1);
  });

  it('never exercises a call early without dividends, but may with them', () => {
    const noDiv = exerciseBoundary('call', { ...DEFAULTS, steps: 150, american: true }, 6);
    expect(noDiv.slice(0, -1).every((p) => p.S === null)).toBe(true);
    const div = exerciseBoundary('call', { ...DEFAULTS, q: 0.08, steps: 150, american: true }, 6);
    expect(div[0].S).not.toBeNull();
    expect(div[0].S!).toBeGreaterThan(DEFAULTS.K);
  });
});

describe('perpetual American put', () => {
  const K = 100, r = 0.05, sigma = 0.2;
  const star = perpetualPutBoundary(K, r, sigma);

  it('has the textbook boundary', () => {
    expect(star).toBeCloseTo(71.42857, 4); // γ = 2.5, S* = 2.5/3.5 · 100
  });

  it('pastes smoothly onto the payoff', () => {
    expect(perpetualPut(star, K, r, sigma)).toBeCloseTo(K - star, 12);
    const h = 1e-5;
    const slope = (perpetualPut(star + h, K, r, sigma) - perpetualPut(star, K, r, sigma)) / h;
    expect(slope).toBeCloseTo(-1, 3);
  });

  it('bounds every finite-maturity American put from above', () => {
    for (const S of [60, 80, 100, 130]) {
      const am = binomialPrice('put', { ...DEFAULTS, S, T: 5, steps: 600, american: true });
      expect(am).toBeLessThanOrEqual(perpetualPut(S, K, r, sigma) + 1e-6);
      expect(am).toBeGreaterThanOrEqual(price('put', { ...DEFAULTS, S, T: 5 }) - 1e-6);
    }
  });
});

describe('GBM paths', () => {
  it('are reproducible and start where told', () => {
    const a = gbmPath(3, 100, 0.05, 0.2, 1, 50);
    expect(a).toEqual(gbmPath(3, 100, 0.05, 0.2, 1, 50));
    expect(a[0]).toBe(100);
    expect(a).toHaveLength(51);
  });
});
