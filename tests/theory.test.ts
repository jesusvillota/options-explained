import { describe, expect, it } from 'vitest';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import { annuity, bachelier, black76, capPrice, discount, forwardRate, NS_DEFAULT, swapRate, swaption, zeroRate } from '../src/lib/rates/curve';
import { calibrateMerton, mertonFirm } from '../src/lib/theory/credit';
import { driftUnder, girsanovWeight, priceFromRealWorld, realWorldSamples } from '../src/lib/theory/measure';
import { explainPnL } from '../src/lib/theory/pnlExplain';

describe('change of measure', () => {
  const input = { S: 100, mu: 0.12, r: 0.05, sigma: 0.2, T: 1 };
  const samples = realWorldSamples(input, 200000, 3);

  it('Girsanov weights average to one', () => {
    const mean = samples.reduce((a, s) => a + s.weight, 0) / samples.length;
    expect(mean).toBeCloseTo(1, 2);
    expect(girsanovWeight(0, 0.35, 1)).toBeCloseTo(Math.exp(-0.5 * 0.35 * 0.35), 12);
  });

  it('reweighted real-world paths give the Black–Scholes price; unweighted ones do not', () => {
    const call = (ST: number) => Math.max(ST - 100, 0);
    const exact = price('call', DEFAULTS);
    expect(priceFromRealWorld(samples, call, 0.05, 1)).toBeCloseTo(exact, 1);
    expect(priceFromRealWorld(samples, call, 0.05, 1, false)).toBeGreaterThan(exact + 2);
  });

  it('the discounted stock is a Q-martingale: E^P[Z e^{−rT} S_T] = S₀', () => {
    expect(priceFromRealWorld(samples, (ST) => ST, 0.05, 1)).toBeCloseTo(100, 0);
  });

  it('drifts under P, Q and the share measure', () => {
    expect(driftUnder('P', input)).toBe(0.12);
    expect(driftUnder('Q', input)).toBe(0.05);
    expect(driftUnder('share', input)).toBeCloseTo(0.09, 12);
  });
});

describe('interest-rate options', () => {
  it('the Nelson–Siegel curve: short rate b0 + b1, long rate b0, discount factors decreasing', () => {
    expect(zeroRate(0, NS_DEFAULT)).toBeCloseTo(0.03, 12);
    expect(zeroRate(200, NS_DEFAULT)).toBeCloseTo(0.04, 2);
    expect(discount(5, NS_DEFAULT)).toBeLessThan(discount(4, NS_DEFAULT));
  });

  it('Black-76 satisfies put–call parity on the forward', () => {
    const P = 0.95;
    expect(black76('call', 0.04, 0.035, 2, 0.25, P) - black76('put', 0.04, 0.035, 2, 0.25, P)).toBeCloseTo(P * (0.04 - 0.035), 12);
  });

  it('Bachelier satisfies parity, handles negative rates, and matches Black for small moves', () => {
    expect(bachelier('call', -0.002, -0.004, 1, 0.006, 0.99) - bachelier('put', -0.002, -0.004, 1, 0.006, 0.99)).toBeCloseTo(0.99 * 0.002, 12);
    // at the money, normal vol ≈ Black vol × F
    expect(bachelier('call', 0.04, 0.04, 1, 0.2 * 0.04, 1)).toBeCloseTo(black76('call', 0.04, 0.04, 1, 0.2, 1), 4);
  });

  it('cap − floor = payer swap (from the second period)', () => {
    const K = 0.04, tau = 0.25, mat = 5;
    const cap = capPrice(K, mat, tau, 0.2, NS_DEFAULT).total;
    const floor = capPrice(K, mat, tau, 0.2, NS_DEFAULT, 'put').total;
    const swap = annuity(tau, mat, tau, NS_DEFAULT) * (swapRate(tau, mat, tau, NS_DEFAULT) - K);
    expect(cap - floor).toBeCloseTo(swap, 10);
  });

  it('the swap rate is a weighted average of forward rates', () => {
    const tau = 0.5, start = 1, end = 6;
    let num = 0, den = 0;
    for (let t = start + tau; t <= end + 1e-9; t += tau) { num += tau * discount(t, NS_DEFAULT) * forwardRate(t - tau, t, NS_DEFAULT); den += tau * discount(t, NS_DEFAULT); }
    expect(swapRate(start, end, tau, NS_DEFAULT)).toBeCloseTo(num / den, 12);
  });

  it('at-the-money payer and receiver swaptions are worth the same', () => {
    const K = swapRate(2, 7, 0.5, NS_DEFAULT);
    expect(swaption('payer', K, 2, 5, 0.5, 0.2, NS_DEFAULT)).toBeCloseTo(swaption('receiver', K, 2, 5, 0.5, 0.2, NS_DEFAULT), 12);
  });
});

describe('Merton credit model', () => {
  it('equity + debt = assets, and debt = riskless bond − put', () => {
    const firm = { A: 120, D: 100, T: 2, r: 0.04, sigmaA: 0.25 };
    const f = mertonFirm(firm);
    expect(f.equity + f.debt).toBeCloseTo(120, 10);
    expect(f.debt).toBeCloseTo(100 * Math.exp(-0.08) - price('put', { S: 120, K: 100, T: 2, r: 0.04, sigma: 0.25 }), 10);
    expect(f.spread).toBeGreaterThan(0);
  });

  it('more leverage or more asset volatility raises the default probability and the spread', () => {
    const base = mertonFirm({ A: 150, D: 100, T: 1, r: 0.03, sigmaA: 0.2 });
    const lev = mertonFirm({ A: 110, D: 100, T: 1, r: 0.03, sigmaA: 0.2 });
    const vol = mertonFirm({ A: 150, D: 100, T: 1, r: 0.03, sigmaA: 0.4 });
    expect(lev.defaultProbability).toBeGreaterThan(base.defaultProbability);
    expect(vol.spread).toBeGreaterThan(base.spread);
    expect(base.equityVol).toBeGreaterThan(0.2); // leverage amplifies volatility
  });

  it('calibration recovers the asset value and volatility from equity data', () => {
    const truth = { A: 140, D: 100, T: 1, r: 0.03, sigmaA: 0.22 };
    const f = mertonFirm(truth);
    const { A, sigmaA } = calibrateMerton(f.equity, f.equityVol, 100, 1, 0.03);
    expect(A).toBeCloseTo(140, 3);
    expect(sigmaA).toBeCloseTo(0.22, 4);
  });
});

describe('P&L explain', () => {
  it('the Greeks explain almost all of a small day’s P&L', () => {
    const book = [{ type: 'call' as const, K: 100, T: 0.5, quantity: 100 }, { type: 'put' as const, K: 90, T: 0.25, quantity: -200 }];
    const res = explainPnL(book, { S: 100, sigma: 0.2, r: 0.03 }, { S: 101.5, sigma: 0.21, r: 0.03 }, 1 / 365);
    expect(Math.abs(res.unexplained)).toBeLessThan(0.05 * Math.abs(res.actual));
    expect(res.delta + res.gamma + res.vega + res.theta + res.vanna + res.unexplained).toBeCloseTo(res.actual, 10);
  });

  it('a big move leaves a larger unexplained part (higher-order terms)', () => {
    const book = [{ type: 'call' as const, K: 100, T: 0.1, quantity: 100 }];
    const small = explainPnL(book, { S: 100, sigma: 0.2, r: 0.03 }, { S: 101, sigma: 0.2, r: 0.03 }, 1 / 365);
    const big = explainPnL(book, { S: 100, sigma: 0.2, r: 0.03 }, { S: 110, sigma: 0.2, r: 0.03 }, 1 / 365);
    expect(Math.abs(big.unexplained)).toBeGreaterThan(20 * Math.abs(small.unexplained));
  });
});
