import { describe, expect, it } from 'vitest';
import { DEFAULTS, greeks, price, secondOrderGreeks } from '../src/lib/pricing/blackScholes';
import { simulateHedge, thetaGammaSplit } from '../src/lib/pricing/hedging';

describe('second-order Greeks', () => {
  it('agree with finite differences of first-order Greeks', () => {
    const h = 1e-4;
    for (const type of ['call', 'put'] as const) {
      const input = { ...DEFAULTS, K: 105, q: 0.02, T: 0.7 };
      const s = secondOrderGreeks(type, input);
      const g = (o: object) => greeks(type, { ...input, ...o });
      expect(s.vanna).toBeCloseTo((g({ sigma: input.sigma + h }).delta - g({ sigma: input.sigma - h }).delta) / (2 * h), 5);
      expect(s.volga).toBeCloseTo((g({ sigma: input.sigma + h }).vega - g({ sigma: input.sigma - h }).vega) / (2 * h), 3);
      // charm = ∂Δ/∂t = −∂Δ/∂τ
      expect(s.charm).toBeCloseTo(-(g({ T: input.T + h }).delta - g({ T: input.T - h }).delta) / (2 * h), 5);
      expect(s.speed).toBeCloseTo((g({ S: input.S + h }).gamma - g({ S: input.S - h }).gamma) / (2 * h), 5);
    }
  });
});

describe('theta–gamma', () => {
  it('breaks even when the move equals σ√dt', () => {
    const dt = 1 / 252;
    const split = thetaGammaSplit('call', DEFAULTS, 0.2 * Math.sqrt(dt), dt);
    expect(split.breakevenMove).toBeCloseTo(0.2 * Math.sqrt(dt), 10);
    expect(Math.abs(split.net)).toBeLessThan(1e-12);
  });

  it('time cost equals theta net of financing the hedge (Black–Scholes PDE)', () => {
    const dt = 1 / 252;
    for (const type of ['call', 'put'] as const) {
      const input = { ...DEFAULTS, q: 0.02, T: 0.4, K: 95 };
      const g = greeks(type, input);
      const hedgedTheta = g.theta + (input.r - input.q) * input.S * g.delta - input.r * price(type, input);
      expect(thetaGammaSplit(type, input, 0, dt).thetaCost).toBeCloseTo(hedgedTheta * dt, 8);
    }
  });
});

describe('delta hedging simulation', () => {
  const base = { type: 'call' as const, S0: 100, K: 100, T: 1, r: 0.05, impliedVol: 0.2, realisedVol: 0.2, mu: 0.1, paths: 400, seed: 1 };

  it('hedges away most of the risk, and more often hedging means less risk', () => {
    const sd = (xs: number[]) => {
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    };
    const weekly = simulateHedge({ ...base, steps: 52 });
    const daily = simulateHedge({ ...base, steps: 252 });
    expect(weekly.premium).toBeCloseTo(price('call', DEFAULTS), 10);
    expect(sd(daily.pnl)).toBeLessThan(sd(weekly.pnl));
    // Std of hedging error ~ premium-sized fraction, far below the unhedged option's risk.
    expect(sd(daily.pnl)).toBeLessThan(1);
    expect(Math.abs(daily.pnl.reduce((a, b) => a + b, 0) / daily.pnl.length)).toBeLessThan(0.15);
  });

  it('loses money for the seller when realised volatility beats implied', () => {
    const r = simulateHedge({ ...base, realisedVol: 0.3, steps: 252 });
    const mean = r.pnl.reduce((a, b) => a + b, 0) / r.pnl.length;
    expect(mean).toBeLessThan(-2);
  });
});
