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

// ---------------------------------------------------------------------------
// Chapter 57: Avellaneda–Stoikov

import { asQuotes, asStats, glftQuotes, optimalSpread, reservationPrice } from '../src/lib/mm/avellanedaStoikov';

describe('Avellaneda–Stoikov', () => {
  const p = { gamma: 0.1, sigma: 2, k: 1.5, A: 140, T: 1 };

  it('shades the reservation price against inventory, less as the horizon nears', () => {
    expect(reservationPrice(100, 0, 0, p)).toBe(100);
    expect(reservationPrice(100, 3, 0, p)).toBeCloseTo(100 - 3 * 0.1 * 4, 12);
    expect(reservationPrice(100, 3, 0.75, p)).toBeCloseTo(100 - 3 * 0.1 * 4 * 0.25, 12);
  });

  it('has the optimal spread γσ²(T − t) + (2/γ)ln(1 + γ/k)', () => {
    expect(optimalSpread(0, p)).toBeCloseTo(0.4 + 20 * Math.log(1 + 0.1 / 1.5), 12);
    const q = asQuotes(100, -2, 0, p);
    expect(q.ask - q.bid).toBeCloseTo(optimalSpread(0, p), 12);
    expect((q.ask + q.bid) / 2).toBeCloseTo(reservationPrice(100, -2, 0, p), 12);
  });

  it('tends to 2/k as risk aversion vanishes, the risk-neutral monopolist spread', () => {
    expect(optimalSpread(0.5, { ...p, gamma: 1e-6 })).toBeCloseTo(2 / 1.5, 4);
  });

  it('gives GLFT quotes that are symmetric at zero inventory and skew linearly in q', () => {
    const z = glftQuotes(100, 0, p), one = glftQuotes(100, 1, p), two = glftQuotes(100, 2, p);
    expect(100 - z.bid).toBeCloseTo(z.ask - 100, 12);
    expect((one.bid - two.bid)).toBeCloseTo(z.bid - one.bid, 12);
    expect(one.ask).toBeLessThan(z.ask);
  });

  it('cuts P&L risk sharply for a small cost in mean, as in the original paper', () => {
    const base = { ...p, dt: 0.005, s0: 100 };
    const inv = asStats({ ...base, strategy: 'inventory' }, 300, 1), sym = asStats({ ...base, strategy: 'symmetric' }, 300, 1);
    expect(inv.sdPnl).toBeLessThan(0.6 * sym.sdPnl);
    expect(inv.meanPnl).toBeGreaterThan(0.9 * sym.meanPnl);
    expect(inv.sdInventory).toBeLessThan(0.5 * sym.sdInventory);
  });
});

// ---------------------------------------------------------------------------
// Chapter 58: making markets in many options

import { quoteShift, simulateVegaBook, vegaBookStats, vegaRisk, volCovariance } from '../src/lib/mm/optionBook';

describe('a book of vega', () => {
  it('has a covariance with vol-of-vol on the diagonal and decaying correlation', () => {
    const O = volCovariance(0.8);
    expect(O[0][0]).toBeCloseTo(2.25, 12);
    expect(O[0][1]).toBeCloseTo(1.5 * 1.0 * 0.8, 12);
    expect(O[0][2]).toBeCloseTo(1.5 * 0.7 * 0.64, 12);
  });

  it('measures risk as √(VᵀΩV), and nets offsetting buckets when they are correlated', () => {
    const O = volCovariance(0.9);
    expect(vegaRisk([1000, 0, 0], O)).toBeCloseTo(1500, 8);
    expect(vegaRisk([1000, -1500, 0], O)).toBeLessThan(vegaRisk([1000, 0, 0], O));
  });

  it('shifts every correlated bucket against a long position in one', () => {
    const d = quoteShift([2000, 0, 0], volCovariance(0.8), 1e-4);
    expect(d[0]).toBeLessThan(0);
    expect(d[1]).toBeLessThan(0);
    expect(d[0]).toBeLessThan(d[1]);
  });

  it('cuts the book’s vol risk sharply by shading, for a small loss of edge', () => {
    const base = { trades: 300, size: 10, edge: 0.5, k: 2, rho: 0.8 };
    const off = vegaBookStats({ ...base, gamma: 0 }, 150, 1), on = vegaBookStats({ ...base, gamma: 3e-5 }, 150, 1);
    expect(on.rmsRisk).toBeLessThan(0.65 * off.rmsRisk);
    expect(on.meanEdge).toBeGreaterThan(0.97 * off.meanEdge);
    expect(simulateVegaBook({ ...base, gamma: 3e-5, seed: 4 })).toEqual(simulateVegaBook({ ...base, gamma: 3e-5, seed: 4 }));
  });
});

// ---------------------------------------------------------------------------
// Chapter 59: hedging with transaction costs

import { lelandNumber, lelandVol, simulateCostHedge, wwBand } from '../src/lib/mm/transactionCosts';

describe('hedging with costs', () => {
  const base = { S0: 100, K: 100, T: 0.25, r: 0.05, sigma: 0.2, eps: 0.002, paths: 200, seed: 1 };

  it("raises the short hedger's volatility by Leland's factor", () => {
    const dt = 1 / 252;
    expect(lelandNumber(0.2, 0.002, dt)).toBeCloseTo(Math.sqrt(2 / Math.PI) * 0.004 / (0.2 * Math.sqrt(dt)), 12);
    expect(lelandVol(0.2, 0.002, dt) ** 2).toBeCloseTo(0.04 * (1 + lelandNumber(0.2, 0.002, dt)), 12);
    expect(lelandVol(0.2, 0.002, dt, false)).toBeLessThan(0.2);
    expect(lelandVol(0.2, 0, dt)).toBeCloseTo(0.2, 12);
  });

  it('has a band that widens with cost and narrows with risk aversion, like the cube root', () => {
    expect(wwBand(0.04, 100, 0.002, 1, 0, 0.25) / wwBand(0.04, 100, 0.002 / 8, 1, 0, 0.25)).toBeCloseTo(2, 10);
    expect(wwBand(0.04, 100, 0.002, 8, 0, 0.25)).toBeCloseTo(wwBand(0.04, 100, 0.002, 1, 0, 0.25) / 2, 10);
  });

  it('trades hedging error against cost when rebalancing on a schedule', () => {
    const slow = simulateCostHedge({ ...base, mode: 'time', steps: 6 }), fast = simulateCostHedge({ ...base, mode: 'time', steps: 126 });
    expect(fast.sdPnl).toBeLessThan(slow.sdPnl);
    expect(fast.meanCost).toBeGreaterThan(slow.meanCost);
  });

  it('lets band hedging reach the same risk more cheaply than the clock', () => {
    const band = simulateCostHedge({ ...base, mode: 'band', steps: 252, riskAversion: 10 });
    const clock = simulateCostHedge({ ...base, mode: 'time', steps: 126 });
    expect(band.sdPnl).toBeLessThan(clock.sdPnl * 1.1);
    expect(band.meanCost).toBeLessThan(0.7 * clock.meanCost);
    expect(band.meanTrades).toBeLessThan(clock.meanTrades);
  });
});

// ---------------------------------------------------------------------------
// Chapter 60: demand-based option pricing

import { DEMAND_PRESETS, DEMAND_STRIKES, demandPremium, demandSmile, unhedgeableCovariance } from '../src/lib/mm/demand';

describe('demand-based pricing', () => {
  it('has a symmetric, positive semi-definite covariance of unhedgeable risk', () => {
    const S = unhedgeableCovariance();
    S.forEach((row, i) => row.forEach((s, j) => expect(s).toBeCloseTo(S[j][i], 14)));
    for (const d of Object.values(DEMAND_PRESETS)) {
      const v = d.demand.reduce((a, x, i) => a + x * S[i].reduce((b, s, j) => b + s * d.demand[j], 0), 0);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('leaves prices alone without demand or without risk aversion', () => {
    expect(demandPremium(DEMAND_PRESETS.none.demand, 3e-6).every((p) => p === 0)).toBe(true);
    expect(demandSmile(DEMAND_PRESETS.index.demand, 0).every((s) => Math.abs(s.withDemand - 0.2) < 1e-8)).toBe(true);
  });

  it('is linear in demand', () => {
    const a = demandPremium(DEMAND_PRESETS.index.demand, 3e-6), b = demandPremium(DEMAND_PRESETS.index.demand.map((x) => 2 * x), 3e-6);
    a.forEach((p, i) => expect(b[i]).toBeCloseTo(2 * p, 12));
  });

  it('makes puts expensive relative to calls when end users buy puts: a skew from demand alone', () => {
    const s = demandSmile(DEMAND_PRESETS.insurance.demand, 3e-6);
    const at = (K: number) => s.find((x) => x.strike === K)!.withDemand;
    expect(at(90)).toBeGreaterThan(at(110) + 0.01);
    expect(at(110)).toBeGreaterThan(0.2);
    expect(DEMAND_STRIKES.length).toBe(s.length);
  });

  it('cheapens options when end users sell', () => {
    const s = demandSmile(DEMAND_PRESETS.overwriting.demand, 3e-6);
    expect(s.every((x) => x.withDemand < 0.2)).toBe(true);
  });
});
