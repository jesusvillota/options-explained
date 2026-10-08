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
