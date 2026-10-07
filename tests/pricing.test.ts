import { describe, expect, it } from 'vitest';
import { DEFAULTS, greeks, price } from '../src/lib/pricing/blackScholes';
import { binomialPrice } from '../src/lib/pricing/binomial';
import { breakeven, legPayoff, legProfit, payoff } from '../src/lib/pricing/payoff';

describe('payoffs', () => {
  it('pays (S−K)⁺ for a call and (K−S)⁺ for a put', () => {
    expect(payoff('call', 120, 100)).toBe(20);
    expect(payoff('call', 80, 100)).toBe(0);
    expect(payoff('put', 80, 100)).toBe(20);
    expect(payoff('put', 120, 100)).toBe(0);
  });

  it('makes long and short positions mirror images (zero-sum)', () => {
    for (const s of [60, 100, 140]) {
      const long = { type: 'call' as const, side: 'long' as const, strike: 100, premium: 10 };
      const short = { ...long, side: 'short' as const };
      expect(legProfit(long, s) + legProfit(short, s)).toBe(0);
      expect(legPayoff(long, s) + legPayoff(short, s)).toBe(0);
    }
  });

  it('breaks even at K + premium (call) and K − premium (put)', () => {
    expect(breakeven('call', 100, 10)).toBe(110);
    expect(breakeven('put', 100, 6)).toBe(94);
    expect(legProfit({ type: 'call', side: 'long', strike: 100, premium: 10 }, 110)).toBe(0);
  });
});

describe('Black–Scholes', () => {
  it('prices the default example', () => {
    expect(price('call', DEFAULTS)).toBeCloseTo(10.450583572185565, 10);
    expect(price('put', DEFAULTS)).toBeCloseTo(5.573526022256971, 10);
  });

  it("matches Hull's example (S=42, K=40, r=10%, σ=20%, T=0.5)", () => {
    const input = { S: 42, K: 40, r: 0.1, sigma: 0.2, T: 0.5 };
    expect(price('call', input)).toBeCloseTo(4.7594, 4);
    expect(price('put', input)).toBeCloseTo(0.8086, 4);
  });

  it('satisfies put–call parity, with dividends', () => {
    for (const K of [70, 100, 130]) {
      const input = { ...DEFAULTS, K, q: 0.03 };
      const lhs = price('call', input) - price('put', input);
      const rhs = input.S * Math.exp(-input.q * input.T) - K * Math.exp(-input.r * input.T);
      expect(lhs).toBeCloseTo(rhs, 10);
    }
  });

  it('collapses to the payoff at expiry', () => {
    expect(price('call', { ...DEFAULTS, S: 120, T: 0 })).toBe(20);
    expect(price('put', { ...DEFAULTS, S: 120, T: 0 })).toBe(0);
  });

  it('has Greeks that agree with finite differences', () => {
    const h = 1e-4;
    for (const type of ['call', 'put'] as const) {
      const input = { ...DEFAULTS, K: 110, q: 0.02 };
      const g = greeks(type, input);
      const bump = (key: 'S' | 'sigma' | 'r' | 'T', dx: number) => price(type, { ...input, [key]: input[key] + dx });
      expect(g.delta).toBeCloseTo((bump('S', h) - bump('S', -h)) / (2 * h), 6);
      expect(g.gamma).toBeCloseTo((bump('S', h) - 2 * price(type, input) + bump('S', -h)) / (h * h), 4);
      expect(g.vega).toBeCloseTo((bump('sigma', h) - bump('sigma', -h)) / (2 * h), 5);
      expect(g.rho).toBeCloseTo((bump('r', h) - bump('r', -h)) / (2 * h), 5);
      // θ = ∂V/∂t = −∂V/∂τ
      expect(g.theta).toBeCloseTo(-(bump('T', h) - bump('T', -h)) / (2 * h), 5);
    }
    expect(greeks('call', DEFAULTS).delta).toBeCloseTo(0.6368306511756191, 12);
  });
});

describe('binomial tree (CRR)', () => {
  it('converges to Black–Scholes for European options', () => {
    expect(binomialPrice('call', { ...DEFAULTS, steps: 1000 })).toBeCloseTo(price('call', DEFAULTS), 2);
    expect(binomialPrice('put', { ...DEFAULTS, steps: 1000 })).toBeCloseTo(price('put', DEFAULTS), 2);
  });

  it('never exercises an American call early without dividends', () => {
    const input = { ...DEFAULTS, steps: 500 };
    expect(binomialPrice('call', { ...input, american: true })).toBeCloseTo(binomialPrice('call', input), 12);
  });

  it('values the early-exercise right of an American put', () => {
    const american = binomialPrice('put', { ...DEFAULTS, steps: 2000, american: true });
    expect(american).toBeCloseTo(6.0903, 2);
    expect(american).toBeGreaterThan(price('put', DEFAULTS));
  });
});
