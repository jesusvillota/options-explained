import { describe, expect, it } from 'vitest';
import { SURFACE_MARKET, black76, black76ImpliedVol, fitSurface, microprice, noisyChain, parityRegression, trueVol } from '../src/lib/mm/surfaceFit';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';

// ---------------------------------------------------------------------------
// Chapter 55: from noisy quotes to a clean surface

describe('surface fitting', () => {
  const rows = noisyChain();
  const { S, r, q, T } = SURFACE_MARKET;
  const trueF = S * Math.exp((r - q) * T), trueB = Math.exp(-r * T);

  it('prices like Black–Scholes when F = S e^{(r − q)T}', () => {
    const bs = price('call', { ...DEFAULTS, K: 105, T: 0.5 });
    expect(black76('call', 100 * Math.exp(0.05 * 0.5), 105, Math.exp(-0.05 * 0.5), 0.5, 0.2)).toBeCloseTo(bs, 10);
    expect(black76ImpliedVol('put', black76('put', 101, 90, 0.99, 0.25, 0.31), 101, 90, 0.99, 0.25)).toBeCloseTo(0.31, 8);
  });

  it('recovers the forward and discount factor from parity once stale strikes are dropped', () => {
    const naive = parityRegression(rows, false), robust = parityRegression(rows, true);
    expect(Math.abs(naive.F - trueF)).toBeGreaterThan(0.2);
    expect(Math.abs(robust.F - trueF)).toBeLessThan(0.05);
    expect(Math.abs(robust.B - trueB)).toBeLessThan(0.001);
    expect(robust.used).not.toContain(90);
    expect(robust.used).not.toContain(110);
  });

  it('fits a smile inside every bid–ask band only after all the cleaning', () => {
    const raw = fitSurface(rows, { dropBad: false, dropStale: false, parityForward: false, weightBySpread: false, otmOnly: false });
    const clean = fitSurface(rows, { dropBad: true, dropStale: true, parityForward: true, weightBySpread: true, otmOnly: false });
    expect(raw.insideBand).toBeLessThan(0.6);
    expect(clean.insideBand).toBe(1);
    expect(clean.rmse).toBeLessThan(0.3);
    expect(clean.rmse).toBeLessThan(raw.rmse / 3);
    expect(Math.abs(clean.vol(100) - trueVol(100))).toBeLessThan(0.005);
  });

  it('flags the crossed put and the zero bids', () => {
    const f = fitSurface(rows, { dropBad: true, dropStale: true, parityForward: true, weightBySpread: true, otmOnly: false });
    expect(f.points.find((p) => p.strike === 105 && p.type === 'put')!.reason).toBe('crossed');
    expect(f.points.find((p) => p.strike === 130 && p.type === 'call')!.reason).toBe('zero bid');
    expect(f.points.filter((p) => p.reason === 'stale').map((p) => p.strike).sort()).toEqual([110, 110, 90, 90]);
  });

  it('leans the microprice towards the thinner side', () => {
    expect(microprice({ bid: 2.4, ask: 2.55, bidSize: 30, askSize: 10 })).toBeCloseTo((2.55 * 30 + 2.4 * 10) / 40, 12);
    expect(microprice({ bid: 2.4, ask: 2.55, bidSize: 30, askSize: 10 })).toBeGreaterThan(2.475);
  });
});

// ---------------------------------------------------------------------------
// Chapter 56: quoting around a theoretical value

import { QUOTING_OPTION, simulateQuoting, volEdgeQuotes } from '../src/lib/mm/quoting';
import { greeks } from '../src/lib/pricing/blackScholes';

describe('quoting', () => {
  const base = { seconds: 23400 * 3, edgeVol: 0.5, tied: true, latency: 5, reaction: 100, sniperSpeed: 50, jumpRate: 1 / 300, jumpSize: 0.4, volJump: 0.005, customerRate: 1 / 20, customerTolerance: 1, seed: 1 };

  it('turns a volatility edge into a price edge of about e_σ × vega', () => {
    const q = volEdgeQuotes('call', QUOTING_OPTION, 1);
    const vega = greeks('call', QUOTING_OPTION).vega * 0.01;
    expect(q.ask - q.theo).toBeCloseTo(vega, 3);
    expect(q.theo - q.bid).toBeCloseTo(vega, 3);
  });

  it('is deterministic, and the market path does not depend on the quotes', () => {
    expect(simulateQuoting({ ...base, seconds: 2000 })).toEqual(simulateQuoting({ ...base, seconds: 2000 }));
    const a = simulateQuoting({ ...base, seconds: 2000, edgeVol: 0.5 }, 2000), b = simulateQuoting({ ...base, seconds: 2000, edgeVol: 1.5 }, 2000);
    expect(a.theo).toEqual(b.theo);
  });

  it('protects against stock news by tying quotes to the stock', () => {
    const loose = simulateQuoting({ ...base, tied: false }), tied = simulateQuoting({ ...base, tied: true });
    expect(tied.sniperLoss).toBeLessThan(0.05 * loose.sniperLoss);
  });

  it('loses more to snipers the slower it reacts', () => {
    const fast = simulateQuoting({ ...base, tied: false, reaction: 5 }), slow = simulateQuoting({ ...base, tied: false, reaction: 300 });
    expect(slow.sniperLoss).toBeGreaterThan(3 * fast.sniperLoss);
  });

  it('trades off customer volume against edge: neither the tightest nor the widest quote earns most', () => {
    const net = (e: number) => { const r = simulateQuoting({ ...base, edgeVol: e }); return r.customerEdge - r.sniperLoss; };
    expect(net(1)).toBeGreaterThan(net(0.25));
    expect(net(1)).toBeGreaterThan(net(2));
  });
});
