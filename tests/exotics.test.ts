import { describe, expect, it } from 'vitest';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import {
  arithmeticAsianMC, barrierMC, basketCallLevy, barrierPrice, callSpreadDigital, correlatedPaths, digitalAsset, digitalCallDelta,
  digitalCash, discreteBarrierShift, gapCall, geometricAsian, margrabe, powerCall, twoAssetMC,
  type BarrierKind,
} from '../src/lib/pricing/exotics';

describe('digitals and friends', () => {
  it('a call is an asset digital minus K cash digitals', () => {
    for (const K of [80, 100, 120]) {
      const input = { ...DEFAULTS, K, q: 0.02 };
      expect(digitalAsset('call', input) - K * digitalCash('call', input)).toBeCloseTo(price('call', input), 10);
      expect(K * digitalCash('put', input) - digitalAsset('put', input)).toBeCloseTo(price('put', input), 10);
    }
  });

  it('a digital call plus a digital put is a zero-coupon bond', () => {
    expect(digitalCash('call', DEFAULTS) + digitalCash('put', DEFAULTS)).toBeCloseTo(Math.exp(-0.05), 12);
  });

  it('narrow call spreads converge to the digital', () => {
    const exact = digitalCash('call', DEFAULTS);
    expect(Math.abs(callSpreadDigital(DEFAULTS, 10) - exact)).toBeGreaterThan(Math.abs(callSpreadDigital(DEFAULTS, 1) - exact));
    expect(callSpreadDigital(DEFAULTS, 0.01)).toBeCloseTo(exact, 6);
  });

  it('digital delta matches a finite difference, and explodes at the money near expiry', () => {
    const h = 1e-3;
    const fd = (digitalCash('call', { ...DEFAULTS, S: 100 + h }) - digitalCash('call', { ...DEFAULTS, S: 100 - h })) / (2 * h);
    expect(digitalCallDelta(DEFAULTS)).toBeCloseTo(fd, 8);
    expect(digitalCallDelta({ ...DEFAULTS, T: 0.001 })).toBeGreaterThan(20 * digitalCallDelta(DEFAULTS));
  });

  it('a gap call with trigger = strike is a vanilla call; power n = 1 is a vanilla call', () => {
    expect(gapCall(DEFAULTS, 100, 100)).toBeCloseTo(price('call', DEFAULTS), 10);
    expect(powerCall(DEFAULTS, 1)).toBeCloseTo(price('call', DEFAULTS), 10);
  });

  it('the power call (n = 2) matches Monte Carlo', () => {
    const input = { ...DEFAULTS, K: 10000 };
    const mc = twoAssetMC((a) => Math.max(a * a - 10000, 0), { S1: 100, S2: 100, sigma1: 0.2, sigma2: 0.2, rho: 0, T: 1, r: 0.05 }, 200000, 3);
    expect(Math.abs(mc.price - powerCall(input, 2))).toBeLessThan(3 * mc.stdError);
  });
});

describe('barriers', () => {
  const kinds: BarrierKind[] = ['down-and-out', 'down-and-in', 'up-and-out', 'up-and-in'];

  it('in + out = vanilla, for calls and puts and barriers either side of the strike', () => {
    for (const type of ['call', 'put'] as const) {
      for (const H of [80, 95, 110, 130]) {
        const down = H < 100;
        const out = barrierPrice(type, down ? 'down-and-out' : 'up-and-out', { ...DEFAULTS, K: 100, q: 0.01 }, H);
        const inn = barrierPrice(type, down ? 'down-and-in' : 'up-and-in', { ...DEFAULTS, K: 100, q: 0.01 }, H);
        expect(out + inn).toBeCloseTo(price(type, { ...DEFAULTS, q: 0.01 }), 10);
        expect(out).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a far-away barrier changes nothing; a barrier through the spot knocks out at once', () => {
    expect(barrierPrice('call', 'down-and-out', DEFAULTS, 1)).toBeCloseTo(price('call', DEFAULTS), 8);
    expect(barrierPrice('put', 'up-and-out', DEFAULTS, 10000)).toBeCloseTo(price('put', DEFAULTS), 8);
    expect(barrierPrice('call', 'down-and-out', DEFAULTS, 100)).toBe(0);
  });

  it('closed forms (with the Broadie–Glasserman–Kou shift) match Monte Carlo with discrete monitoring', () => {
    const steps = 50, dt = 1 / steps;
    const cases: [ 'call' | 'put', BarrierKind, number, number][] = [['call', 'down-and-out', 100, 90], ['call', 'up-and-out', 100, 130], ['put', 'down-and-in', 105, 85], ['put', 'up-and-out', 100, 115]];
    for (const [type, kind, K, H] of cases) {
      const input = { ...DEFAULTS, K };
      const mc = barrierMC(type, kind, input, H, steps, 40000, 7);
      const shifted = barrierPrice(type, kind, input, discreteBarrierShift(H, 100, 0.2, dt));
      expect(Math.abs(mc.price - shifted)).toBeLessThan(3.5 * mc.stdError + 0.02);
    }
    expect(kinds.length).toBe(4);
  });
});

describe('Asian options', () => {
  it('with one fixing at expiry the geometric Asian is a vanilla', () => {
    expect(geometricAsian('call', DEFAULTS, 1)).toBeCloseTo(price('call', DEFAULTS), 10);
    expect(geometricAsian('put', DEFAULTS, 1)).toBeCloseTo(price('put', DEFAULTS), 10);
  });

  it('many fixings approach the continuous geometric formula (vol σ/√3, carry ½(r − σ²/6))', () => {
    const { S, K, T, r, sigma } = DEFAULTS;
    const sa = sigma / Math.sqrt(3), b = 0.5 * (r - (sigma * sigma) / 6);
    const continuous = price('call', { S: S * Math.exp((b - r) * T), K, T, r, sigma: sa });
    expect(geometricAsian('call', DEFAULTS, 20000)).toBeCloseTo(continuous, 3); // the gap closes like 1/n (≈ 2e-4 here)
  });

  it('arithmetic ≥ geometric, and the control variate shrinks the error enormously', () => {
    const res = arithmeticAsianMC('call', DEFAULTS, 12, 20000, 5);
    expect(res.price).toBeGreaterThan(geometricAsian('call', DEFAULTS, 12));
    expect(res.stdError).toBeLessThan(res.plainStdError / 20);
    expect(Math.abs(res.price - res.plain)).toBeLessThan(4 * res.plainStdError);
  });
});

describe('multi-asset', () => {
  it('Margrabe matches Monte Carlo and is independent of the interest rate', () => {
    const input = { S1: 100, S2: 95, sigma1: 0.3, sigma2: 0.2, rho: 0.4, T: 1, r: 0.07 };
    const mc = twoAssetMC((a, b) => Math.max(a - b, 0), input, 100000, 9);
    const exact = margrabe(100, 95, 1, 0.3, 0.2, 0.4);
    expect(Math.abs(mc.price - exact)).toBeLessThan(3 * mc.stdError);
  });

  it('exchange-option parity: M(S₁, S₂) − M(S₂, S₁) = S₁e^{−q₁T} − S₂e^{−q₂T}', () => {
    expect(margrabe(100, 90, 2, 0.25, 0.3, 0.2, 0.01, 0.03) - margrabe(90, 100, 2, 0.3, 0.25, 0.2, 0.03, 0.01)).toBeCloseTo(100 * Math.exp(-0.02) - 90 * Math.exp(-0.06), 10);
  });

  it('perfectly correlated assets with equal vols make the exchange option intrinsic', () => {
    expect(margrabe(100, 90, 1, 0.2, 0.2, 1)).toBeCloseTo(10, 10);
  });

  it('Cholesky paths have the requested correlation', () => {
    const [a, b] = correlatedPaths(4, 100, 100, 0.2, 0.3, -0.6, 0.05, 1, 5000);
    const ra = a.slice(1).map((v, i) => Math.log(v / a[i])), rb = b.slice(1).map((v, i) => Math.log(v / b[i]));
    const m = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
    const ma = m(ra), mb = m(rb);
    const cov = m(ra.map((v, i) => (v - ma) * (rb[i] - mb)));
    const corr = cov / Math.sqrt(m(ra.map((v) => (v - ma) ** 2)) * m(rb.map((v) => (v - mb) ** 2)));
    expect(corr).toBeCloseTo(-0.6, 1);
  });

  it('Levy moment matching prices a two-asset basket call close to Monte Carlo', () => {
    for (const rho of [-0.5, 0, 0.5, 0.9]) {
      const input = { S1: 100, S2: 100, sigma1: 0.25, sigma2: 0.25, rho, T: 1, r: 0.05 };
      const mc = twoAssetMC((a, b) => Math.max(0.5 * (a + b) - 100, 0), input, 200000, 13);
      expect(Math.abs(basketCallLevy(0.5, 0.5, input, 100) - mc.price)).toBeLessThan(0.02 * mc.price + 3 * mc.stdError);
    }
  });
});

