import { describe, expect, it } from 'vitest';
import { balanceAt, continuousEquivalent, discountFactor, forwardArbitrage, forwardPrice, forwardValue, growthFactor } from '../src/lib/pricing/rates';

describe('compounding', () => {
  it('converges to e^{rT} as compounding gets more frequent', () => {
    expect(growthFactor(0.05, 1, 1)).toBeCloseTo(1.05, 12);
    expect(growthFactor(0.05, 1, 12)).toBeCloseTo(1.0511618978817, 12);
    expect(growthFactor(1, 1, 1e6)).toBeCloseTo(Math.E, 5);
    expect(growthFactor(0.05, 2)).toBeCloseTo(Math.exp(0.1), 14);
  });

  it('credits interest in steps', () => {
    expect(balanceAt(0.12, 0.49, 2)).toBe(1);
    expect(balanceAt(0.12, 0.5, 2)).toBeCloseTo(1.06, 12);
    expect(balanceAt(0.12, 1, 2)).toBeCloseTo(1.1236, 12);
  });

  it('converts between conventions consistently', () => {
    const rc = continuousEquivalent(0.05, 4);
    expect(Math.exp(rc)).toBeCloseTo(growthFactor(0.05, 1, 4), 12);
    expect(discountFactor(0.05, 1) * growthFactor(0.05, 1)).toBeCloseTo(1, 14);
  });
});

describe('forwards', () => {
  it('prices a forward by cost of carry', () => {
    expect(forwardPrice({ S: 100, r: 0.05, T: 1 })).toBeCloseTo(105.12710963760242, 10);
    expect(forwardPrice({ S: 100, r: 0.05, q: 0.05, T: 3 })).toBeCloseTo(100, 12);
  });

  it('gives a forward at the fair price zero value', () => {
    const input = { S: 100, r: 0.05, q: 0.02, T: 2 };
    expect(forwardValue({ ...input, K: forwardPrice(input) })).toBeCloseTo(0, 12);
    expect(forwardValue({ ...input, K: 90 })).toBeGreaterThan(0);
  });

  it('finds cash-and-carry when the forward is too dear and the reverse when too cheap', () => {
    const input = { S: 100, r: 0.05, T: 1 };
    const fair = forwardPrice(input);
    expect(forwardArbitrage(input, fair + 3)).toEqual({ kind: 'cash-and-carry', profitAtT: expect.closeTo(3, 10) });
    expect(forwardArbitrage(input, fair - 2)).toEqual({ kind: 'reverse', profitAtT: expect.closeTo(2, 10) });
    expect(forwardArbitrage(input, fair).kind).toBeNull();
  });
});
