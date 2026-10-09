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

// ---------------------------------------------------------------------------
// Chapter 51: Kyle's model

import { bestResponsePath, insiderBestResponse, insiderProfit, kyleEquilibrium, makerBestResponse, simulateKyle } from '../src/lib/info/kyle';

describe("Kyle's one-period model", () => {
  const S0 = 0.3 ** 2, SU = 100;

  it('has λ = √Σ0/(2σ_u) and β = σ_u/√Σ0', () => {
    const e = kyleEquilibrium(S0, SU);
    expect(e.lambda).toBeCloseTo(0.0015, 15);
    expect(e.beta).toBeCloseTo(100 / 0.3, 10);
    expect(e.lambda * e.beta).toBeCloseTo(0.5, 12);
  });

  it('is a fixed point of both best responses', () => {
    const e = kyleEquilibrium(S0, SU);
    expect(insiderBestResponse(e.lambda)).toBeCloseTo(e.beta, 8);
    expect(makerBestResponse(e.beta, S0, SU)).toBeCloseTo(e.lambda, 14);
  });

  it('maximises the insider’s profit at x = (v − p0)/(2λ)', () => {
    const lambda = 0.0015, d = 0.25, best = d / (2 * lambda);
    for (const x of [0.5 * best, 0.9 * best, 1.1 * best, 2 * best]) expect(insiderProfit(d, x, lambda)).toBeLessThan(insiderProfit(d, best, lambda));
  });

  it('converges quickly when firms take turns best-responding', () => {
    const path = bestResponsePath(0.01, S0, SU, 6);
    const e = kyleEquilibrium(S0, SU);
    expect(Math.abs(path[6].lambda / e.lambda - 1)).toBeLessThan(1e-6);
    expect(Math.abs(path[1].lambda / e.lambda - 1)).toBeLessThan(Math.abs(path[0].lambda / e.lambda - 1));
  });

  it('reveals exactly half the private information, and insiders win what noise traders lose', () => {
    const e = kyleEquilibrium(S0, SU);
    expect(e.posteriorVar).toBeCloseTo(S0 / 2, 15);
    expect(e.insiderProfit).toBeCloseTo(e.noiseLoss, 12);
    expect(e.insiderProfit).toBeCloseTo(0.5 * SU * 0.3, 12);
  });

  it('matches the formulas in simulation', () => {
    const draws = simulateKyle(2.48, S0, SU, 40000, 3);
    const n = draws.length;
    const mean = (f: (d: (typeof draws)[number]) => number) => draws.reduce((a, d) => a + f(d), 0) / n;
    // Order flow has variance 2σ_u²: the insider is exactly as variable as the noise.
    expect(mean((d) => d.y * d.y) / (2 * SU * SU)).toBeCloseTo(1, 1);
    // What's left to learn after the trade: E[(v − p)²] = Σ0/2.
    expect(mean((d) => (d.v - d.p) ** 2) / (S0 / 2)).toBeCloseTo(1, 1);
    // The insider's average profit, σ_u√Σ0/2 = 15.
    expect(mean((d) => (d.v - d.p) * d.x) / 15).toBeCloseTo(1, 1);
    // The market maker breaks even.
    expect(Math.abs(mean((d) => (d.p - d.v) * d.y))).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Chapter 52: Kyle in continuous time

import { kyleContinuous, posteriorVariance, simulateKyleContinuous } from '../src/lib/info/kyle';
import { normalRng } from '../src/lib/math/rng';

describe('continuous-time Kyle (Back)', () => {
  const S0 = 0.3 ** 2, SU = 1000, T = 1;

  it('has a constant λ = √Σ0/(σ_u√T) and doubles the one-shot profit', () => {
    const e = kyleContinuous(S0, SU, T);
    expect(e.lambda).toBeCloseTo(0.0003, 15);
    expect(e.priceVol).toBeCloseTo(0.3, 12);
    expect(e.insiderProfit).toBeCloseTo(2 * kyleEquilibrium(S0, SU).insiderProfit, 10);
    expect(posteriorVariance(S0, 0.25, 1)).toBeCloseTo(0.75 * S0, 15);
  });

  it('drives the price to the insider’s value by the close', () => {
    for (const v of [2.0, 2.48, 3.1]) {
      const path = simulateKyleContinuous({ p0: 2.48, sigma0Sq: S0, sigmaU: SU, T, steps: 2000, v, insider: true, seed: 11 });
      expect(Math.abs(path.p[2000] - v)).toBeLessThan(0.03);
    }
  });

  it('reveals information linearly in time, and earns σ_u√(Σ0 T) on average', () => {
    const z = normalRng(77);
    const runs = 1500, steps = 200;
    let gap2 = 0, profit = 0;
    for (let k = 0; k < runs; k++) {
      const v = 2.48 + 0.3 * z();
      const path = simulateKyleContinuous({ p0: 2.48, sigma0Sq: S0, sigmaU: SU, T, steps, v, insider: true, seed: 1000 + k });
      gap2 += (v - path.p[steps / 2]) ** 2 / runs;
      profit += path.profit[steps] / runs;
    }
    expect(gap2 / (S0 / 2)).toBeCloseTo(1, 1);
    expect(profit / 300).toBeGreaterThan(0.85);
    expect(profit / 300).toBeLessThan(1.15);
  });
});

// ---------------------------------------------------------------------------
// Chapter 53: informed trading in options

import { dayLogLikelihood, fitPin, pin, simulatePinDays } from '../src/lib/info/pin';
import { venueReturns } from '../src/lib/info/venue';

describe('PIN', () => {
  const p = { alpha: 0.4, delta: 0.5, mu: 40, eps: 50 };

  it('is the informed share of expected order flow', () => {
    expect(pin(p)).toBeCloseTo(16 / 116, 12);
    expect(pin({ ...p, alpha: 0 })).toBe(0);
  });

  it('has a likelihood that sums to one over all outcomes', () => {
    let total = 0;
    for (let b = 0; b < 60; b++) for (let s = 0; s < 60; s++) total += Math.exp(dayLogLikelihood(b, s, { alpha: 0.3, delta: 0.4, mu: 6, eps: 5 }));
    expect(total).toBeCloseTo(1, 6);
  });

  it('recovers the parameters from simulated days by maximum likelihood', () => {
    const f = fitPin(simulatePinDays(p, 250, 3));
    expect(f.alpha).toBeCloseTo(0.4, 1);
    expect(Math.abs(f.mu - 40) / 40).toBeLessThan(0.1);
    expect(Math.abs(f.eps - 50) / 50).toBeLessThan(0.05);
    expect(Math.abs(f.pin - pin(p))).toBeLessThan(0.03);
  });
});

describe('venue choice', () => {
  const strikes = [95, 100, 105, 110, 115, 120];

  it('gives the stock a return equal to the move, less the half-spread', () => {
    const r = venueReturns(0.03, 1 / 12, strikes)[0];
    expect(r.ret).toBeCloseTo((103 - 100.01) / 100.01, 12);
  });

  it('makes slightly out-of-the-money calls the best bet on moderate news, and wings losers on small news', () => {
    const small = venueReturns(0.01, 1 / 12, strikes);
    const far = small.find((r) => r.strike === 120)!;
    expect(far.ret).toBeLessThan(-0.5);
    const mid = venueReturns(0.03, 1 / 12, strikes);
    const best = mid.reduce((a, b) => (b.ret > a.ret ? b : a));
    expect(best.strike).toBe(105);
    expect(best.ret).toBeGreaterThan(30 * mid[0].ret);
  });

  it('uses puts on bad news', () => {
    const r = venueReturns(-0.05, 1 / 12, [80, 85, 90, 95, 100]);
    expect(r[0].label).toBe('Short stock');
    expect(r[1].type).toBe('put');
    expect(r[0].ret).toBeCloseTo((99.99 - 95) / 99.99, 12);
  });
});

// ---------------------------------------------------------------------------
// Chapter 54: price discovery

import { discoveryShares, fitVECM, impliedStock, ols, simulateTwoMarkets } from '../src/lib/info/priceDiscovery';

describe('price discovery', () => {
  const run = (kStock: number, kOption: number, seed = 1) => {
    const s = simulateTwoMarkets({ n: 6000, m0: 100, sigmaM: 0.05, kStock, kOption, noise: 0.01, seed });
    return discoveryShares(fitVECM(s.stock, s.option, 2));
  };

  it('solves least squares exactly on a noiseless line', () => {
    const X = [[1, 0], [1, 1], [1, 2], [1, 3]];
    expect(ols(X, [1, 3, 5, 7]).map((b) => Math.round(b * 1e9) / 1e9)).toEqual([1, 2]);
  });

  it('reads the stock price off parity', () => {
    expect(impliedStock(4.615, 3.373, 100, 0.05, 0.25)).toBeCloseTo(100, 2);
  });

  it('gives the faster market the larger share of price discovery', () => {
    const fastStock = run(0.8, 0.2), fastOption = run(0.2, 0.8);
    expect(fastStock.componentShare).toBeGreaterThan(0.6);
    expect(fastOption.componentShare).toBeLessThan(0.4);
    expect(fastStock.infoShareHigh).toBeGreaterThan(fastOption.infoShareHigh);
    expect(fastStock.infoShareLow).toBeGreaterThan(fastOption.infoShareLow);
  });

  it('keeps the information share bounds inside [0, 1], around the component share when markets are alike', () => {
    const d = run(0.5, 0.5);
    expect(d.infoShareLow).toBeGreaterThanOrEqual(0);
    expect(d.infoShareHigh).toBeLessThanOrEqual(1);
    expect(d.componentShare).toBeGreaterThan(0.35);
    expect(d.componentShare).toBeLessThan(0.65);
  });

  it('keeps the two prices together: their gap is stationary', () => {
    const s = simulateTwoMarkets({ n: 6000, m0: 100, sigmaM: 0.05, kStock: 0.5, kOption: 0.3, noise: 0.01, seed: 2 });
    const gaps = s.stock.map((p, i) => p - s.option[i]);
    const sd = Math.sqrt(gaps.reduce((a, g) => a + g * g, 0) / gaps.length);
    expect(sd).toBeLessThan(0.2);
    expect(Math.abs(s.m[6000] - s.m[0])).toBeGreaterThan(sd);
  });
});
