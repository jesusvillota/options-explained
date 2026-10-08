import { describe, expect, it } from 'vitest';
import { dealerStats, reservationQuotes, simulateDealer, stationaryInventoryVariance } from '../src/lib/info/inventory';

// ---------------------------------------------------------------------------
// Chapter 49: inventory

describe('the one-period dealer (Stoll, Ho–Stoll)', () => {
  it('centres its quotes on v − γσ²τ q, γσ²τ apart', () => {
    const q = reservationQuotes(100, 0, 2, 0.01);
    expect(q.bid).toBeCloseTo(99.99, 12);
    expect(q.ask).toBeCloseTo(100.01, 12);
    const long = reservationQuotes(100, 5, 2, 0.01);
    expect(long.mid).toBeCloseTo(100 - 0.1, 12);
    expect(long.spread).toBeCloseTo(0.02, 12);
  });

  it('is indifferent at its reservation prices under CARA certainty equivalents', () => {
    // CE(q) = q v − ½ γ σ²τ q²; buying one more unit at the bid leaves CE unchanged.
    const v = 100, g = 3, s2 = 0.02, ce = (q: number) => q * v - 0.5 * g * s2 * q * q;
    for (const q of [-4, 0, 7]) {
      const { bid, ask } = reservationQuotes(v, q, g, s2);
      expect(ce(q + 1) - bid).toBeCloseTo(ce(q), 10);
      expect(ce(q - 1) + ask).toBeCloseTo(ce(q), 10);
    }
  });
});

describe('a dealer through the day', () => {
  const base = { steps: 390, dt: 1, v0: 2.48, sigma: 0.475 / Math.sqrt(390), h: 0.075, A: 0.5, k: 20 };

  it('is deterministic for a seed', () => {
    expect(simulateDealer({ ...base, shade: 0.005, seed: 3 })).toEqual(simulateDealer({ ...base, shade: 0.005, seed: 3 }));
  });

  it('cuts inventory and P&L risk by shading, at little cost', () => {
    const off = dealerStats({ ...base, shade: 0 }, 300, 1), on = dealerStats({ ...base, shade: 0.005 }, 300, 1);
    expect(on.rmsInventory).toBeLessThan(0.4 * off.rmsInventory);
    expect(on.sdPnl).toBeLessThan(0.5 * off.sdPnl);
    expect(Math.abs(on.meanPnl - off.meanPnl)).toBeLessThan(0.1 * off.meanPnl);
  });

  it('earns most with a half-spread near 1/k, the arrival decay length', () => {
    const pnl = (h: number) => dealerStats({ ...base, h, shade: 0.005 }, 200, 2).meanPnl;
    expect(pnl(0.05)).toBeGreaterThan(pnl(0.02));
    expect(pnl(0.05)).toBeGreaterThan(pnl(0.12));
  });
});

describe('mean-reverting inventory', () => {
  it('has stationary variance ≈ 1/(4β) for small β', () => {
    expect(stationaryInventoryVariance(0.01)).toBeCloseTo(1 / (4 * 0.01) / (1 - 0.01), 8);
    expect(stationaryInventoryVariance(0.001) * 4 * 0.001).toBeCloseTo(1, 2);
  });
});

// ---------------------------------------------------------------------------
// Chapter 50: Glosten–Milgrom

import { buyProbabilities, gmQuotes, learningRate, simulateGM, updateBelief } from '../src/lib/info/glostenMilgrom';

describe('Glosten–Milgrom', () => {
  const params = { alpha: 0.3, vL: 2.2, vH: 2.8 };

  it('sets ask = E[v | buy] and bid = E[v | sell], with spread α(v_H − v_L) at p = ½', () => {
    const q = gmQuotes(0.5, params);
    expect(q.ask - q.bid).toBeCloseTo(0.3 * 0.6, 12);
    expect(q.mid).toBeCloseTo(2.5, 12);
    expect(updateBelief(0.5, 0.3, 1)).toBeCloseTo(0.65, 12);
    expect(updateBelief(0.5, 0.3, -1)).toBeCloseTo(0.35, 12);
  });

  it('makes the belief a martingale under the market maker’s information', () => {
    for (const p of [0.1, 0.5, 0.83]) {
      const q = gmQuotes(p, params);
      const next = q.pBuy * updateBelief(p, 0.3, 1) + (1 - q.pBuy) * updateBelief(p, 0.3, -1);
      expect(next).toBeCloseTo(p, 12);
      // Zero expected profit: the mid is the probability-weighted average of the quotes.
      expect(q.pBuy * q.ask + (1 - q.pBuy) * q.bid).toBeCloseTo(q.mid, 12);
    }
  });

  it('has no spread without insiders, and the full range with only insiders', () => {
    expect(gmQuotes(0.5, { ...params, alpha: 0 }).ask - gmQuotes(0.5, { ...params, alpha: 0 }).bid).toBeCloseTo(0, 12);
    const all = gmQuotes(0.5, { ...params, alpha: 0.999999 });
    expect(all.ask - all.bid).toBeCloseTo(0.6, 4);
    expect(buyProbabilities(0.3).high).toBeCloseTo(0.65, 12);
    expect(buyProbabilities(0.3).low).toBeCloseTo(0.35, 12);
  });

  it('learns the truth, and insiders win what the uninformed lose', () => {
    const path = simulateGM({ ...params, p0: 0.5, high: true, n: 400, seed: 1 });
    expect(path.belief[400]).toBeGreaterThan(0.999);
    const n = path.trades.length;
    expect(path.insiderPnl[n]).toBeGreaterThan(0);
    expect(path.uninformedPnl[n]).toBeLessThan(0);
    expect(path.insiderPnl[n] + path.uninformedPnl[n] + path.makerPnl[n]).toBeCloseTo(0, 10);
    const low = simulateGM({ ...params, p0: 0.5, high: false, n: 400, seed: 1 });
    expect(low.belief[400]).toBeLessThan(0.001);
  });

  it('breaks even on average across many runs', () => {
    let mm = 0;
    for (let s = 0; s < 400; s++) {
      const path = simulateGM({ ...params, p0: 0.5, high: s % 2 === 0, n: 40, seed: 100 + s });
      mm += path.makerPnl[40];
    }
    expect(Math.abs(mm / 400)).toBeLessThan(0.02);
  });

  it('learns at about 2α² per trade', () => {
    expect(learningRate(0.05)).toBeCloseTo(2 * 0.05 ** 2, 4);
  });
});

import { averageProfits } from '../src/lib/info/glostenMilgrom';

describe('Glosten–Milgrom average profits', () => {
  it('transfers from the uninformed to insiders, with the market maker near zero', () => {
    const a = averageProfits({ alpha: 0.3, vL: 2.2, vH: 2.8, n: 40, runs: 2000, seed: 9 });
    expect(a.insider[40]).toBeGreaterThan(0.1);
    expect(a.uninformed[40]).toBeLessThan(-0.1);
    expect(Math.abs(a.maker[40])).toBeLessThan(0.15 * a.insider[40]);
  });
});
