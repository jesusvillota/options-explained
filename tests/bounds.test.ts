import { describe, expect, it } from 'vitest';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import { boundViolation, optionBounds } from '../src/lib/pricing/bounds';

describe('no-arbitrage bounds', () => {
  it('contain the Black–Scholes price for many inputs', () => {
    for (const S of [40, 80, 100, 130, 200])
      for (const T of [0.1, 1, 5])
        for (const q of [0, 0.03]) {
          const input = { ...DEFAULTS, S, T, q };
          for (const type of ['call', 'put'] as const) {
            const { lower, upper } = optionBounds(type, input);
            const p = price(type, input);
            expect(p).toBeGreaterThanOrEqual(lower - 1e-9);
            expect(p).toBeLessThanOrEqual(upper + 1e-9);
          }
        }
  });

  it('match hand calculations', () => {
    const b = optionBounds('call', { S: 100, K: 90, r: 0.05, T: 1, sigma: 0.2 });
    expect(b.lower).toBeCloseTo(100 - 90 * Math.exp(-0.05), 12);
    expect(b.upper).toBe(100);
    expect(optionBounds('put', { S: 100, K: 90, r: 0.05, T: 1, sigma: 0.2 }).lower).toBe(0);
  });

  it('collapse onto the payoff as expiry approaches', () => {
    const b = optionBounds('call', { ...DEFAULTS, S: 120, T: 1e-9 });
    expect(b.lower).toBeCloseTo(20, 6);
  });

  it('name the arbitrage when a price breaks them', () => {
    expect(boundViolation('call', DEFAULTS, 120)).toMatchObject({ bound: 'upper', profitToday: 20 });
    const low = boundViolation('call', { ...DEFAULTS, S: 150 }, 40)!;
    expect(low.bound).toBe('lower');
    expect(low.profitToday).toBeCloseTo(150 - 100 * Math.exp(-0.05) - 40, 10);
    expect(boundViolation('put', DEFAULTS, 99)?.bound).toBe('upper');
    expect(boundViolation('call', DEFAULTS, price('call', DEFAULTS))).toBeNull();
  });
});
