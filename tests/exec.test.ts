import { describe, expect, it } from 'vitest';
import {
  averagePaid,
  binImpact,
  fitPowerLaw,
  kernel,
  latentBook,
  metaorderPath,
  noisyPath,
  simulateMetaorders,
  sqrtLawImpact,
} from '../src/lib/exec/impact';
import {
  AC_DEFAULTS,
  costVariance,
  discreteExpectedCost,
  expectedCost,
  frontier,
  halfLife,
  holdings,
  kappa,
  objective,
  schedule,
  simulateShortfall,
  tradingRate,
} from '../src/lib/exec/almgrenChriss';
import {
  blockSchedule,
  continuousTwapCost,
  dentPath,
  dentsBefore,
  flashImpact,
  obizhaevaWang,
  optimalSchedule,
  pumpAndDump,
  scheduleCost,
  tradeTimes,
  twapSchedule,
} from '../src/lib/exec/transientImpact';
import { solveLinear } from '../src/lib/math/linear';
import {
  BINS,
  algoSchedule,
  expectedWait,
  hitProbability,
  limitOrderCost,
  shortfall,
  simulateDay,
  simulateLimitOrder,
  slippageVsVwap,
  trackingStudy,
  volumeCurve,
} from '../src/lib/exec/algos';
import {
  allocate,
  entryCost,
  hedgingDragVol,
  impactVol,
  ladderFraction,
  strikeRows,
  tiedPrice,
  volTradePlan,
} from '../src/lib/exec/optionExecution';

describe('Chapter 61: price impact', () => {
  it('square-root law: 1% of daily volume with Y = 0.7 and σ = 2% moves the price 14 bp', () => {
    expect(sqrtLawImpact(0.01, 200, 0.7)).toBeCloseTo(14, 10);
    expect(sqrtLawImpact(0.04, 200, 0.7)).toBeCloseTo(28, 10);
  });

  it('latent book: impact exponent is 1/(α + 1), calibrated to the square-root law at 1%', () => {
    for (const alpha of [0, 0.5, 1, 2]) expect(latentBook(alpha, 200).impact(0.01)).toBeCloseTo(14, 10);
    expect(latentBook(1, 200).impact(0.04)).toBeCloseTo(28, 10);
    expect(latentBook(0, 200).impact(0.02)).toBeCloseTo(28, 10);
    expect(latentBook(2, 200).impact(0.08)).toBeCloseTo(28, 10);
  });

  it('latent book: the liquidity between the price and the impact equals the order size', () => {
    for (const alpha of [0, 1, 1.7]) {
      const b = latentBook(alpha, 200);
      for (const q of [0.001, 0.02, 0.05]) expect(b.cumulative(b.impact(q))).toBeCloseTo(q, 12);
    }
    // V-shaped book: ρ(x) = L x with L = 2 / c², c = 140 bp.
    const v = latentBook(1, 200);
    expect(v.L).toBeCloseTo(2 / 140 ** 2, 15);
    expect(v.density(10)).toBeCloseTo((2 / 140 ** 2) * 10, 15);
  });

  it('binning: means and standard errors', () => {
    const orders = [
      { q: 0.001, duration: 0, impact: 1 },
      { q: 0.001, duration: 0, impact: 3 },
      { q: 0.05, duration: 0, impact: 10 },
      { q: 0.05, duration: 0, impact: 14 },
    ];
    const bins = binImpact(orders, 2, 1e-4, 0.1);
    expect(bins).toHaveLength(2);
    expect(bins[0].mean).toBe(2);
    expect(bins[0].se).toBeCloseTo(1, 12); // sample sd √2, over √2
    expect(bins[1].mean).toBe(12);
    expect(bins[1].q).toBeCloseTo(0.05, 12);
  });

  it('power-law fit recovers exact exponents and prefactors', () => {
    const bins = [1e-3, 3e-3, 1e-2, 3e-2].map((q) => ({ q, mean: 140 * q ** 0.5 }));
    const f = fitPowerLaw(bins);
    expect(f.exponent).toBeCloseTo(0.5, 12);
    expect(f.prefactor).toBeCloseTo(140, 9);
    expect(fitPowerLaw([...bins, { q: 0.05, mean: -1 }]).used).toBe(4);
  });

  it('simulated metaorders reproduce the book shape’s exponent', () => {
    for (const [alpha, target] of [[1, 0.5], [0, 1], [2, 1 / 3]]) {
      const orders = simulateMetaorders({ n: 100000, seed: 61, alpha, sigmaDay: 200, participation: 0.1 });
      expect(fitPowerLaw(binImpact(orders)).exponent).toBeCloseTo(target, 1);
    }
  });

  it('simulation is seeded and executes at the participation rate', () => {
    const a = simulateMetaorders({ n: 50, seed: 3, alpha: 1, sigmaDay: 200, participation: 0.1 });
    const b = simulateMetaorders({ n: 50, seed: 3, alpha: 1, sigmaDay: 200, participation: 0.1 });
    expect(a).toEqual(b);
    for (const o of a) expect(o.duration).toBeCloseTo(Math.min(o.q / 0.1, 1), 12);
  });

  it('propagator kernel decays as a power law to the permanent floor', () => {
    expect(kernel(0, { beta: 0.5, permanent: 0.1 })).toBeCloseTo(1, 12);
    expect(kernel(3, { beta: 0.5, permanent: 0 })).toBeCloseTo(0.5, 12);
    expect(kernel(1e12, { beta: 0.5, permanent: 0.1 })).toBeCloseTo(0.1, 5);
  });

  it('a permanent kernel gives linear growth and no decay; average paid is half the peak', () => {
    const p = metaorderPath({ beta: 0, permanent: 0 }, 60, 180, 30);
    expect(p[30]).toBeCloseTo(15, 10);
    expect(p[60]).toBeCloseTo(30, 10);
    expect(p[180]).toBeCloseTo(30, 10);
    expect(averagePaid(p, 60)).toBeCloseTo(15, 10);
  });

  it('power-law kernel: concave growth, peak when buying stops, then decay', () => {
    const p = metaorderPath({ beta: 0.5, permanent: 0 }, 60, 180, 30);
    expect(p[60]).toBeCloseTo(30, 10);
    expect(Math.max(...p)).toBeCloseTo(30, 10);
    // Close to the continuum √(t/T) shape: √½ ≈ 0.71 of the peak halfway.
    expect(p[30] / 30).toBeGreaterThan(0.64);
    expect(p[30] / 30).toBeLessThan(0.72);
    for (let t = 61; t <= 180; t++) expect(p[t]).toBeLessThan(p[t - 1]);
    // A permanent floor slows the decay.
    const q = metaorderPath({ beta: 0.5, permanent: 0.1 }, 60, 180, 30);
    expect(q[120]).toBeGreaterThan(p[120]);
    expect(q[120] / 30).toBeCloseTo(0.64, 1);
  });

  it('noisy paths are seeded and reduce to the expected path without noise', () => {
    const p = metaorderPath({ beta: 0.5, permanent: 0.1 }, 60, 180, 30);
    expect(noisyPath(p, 0, 1)).toEqual(p);
    expect(noisyPath(p, 5, 9)).toEqual(noisyPath(p, 5, 9));
  });
});

describe('Chapter 62: Almgren–Chriss', () => {
  const p = AC_DEFAULTS;
  const integrate = (f: (t: number) => number, T: number, n = 20000) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += f(((i + 0.5) * T) / n);
    return (s * T) / n;
  };

  it('TWAP limit: E = ½λX² + ηX²/T = $350,000 and Var = σ²X²T/3', () => {
    const twap = { ...p, gamma: 0 };
    expect(expectedCost(twap)).toBeCloseTo(350000, 6);
    expect(costVariance(twap)).toBeCloseTo((4 * 1e12) / 3, -3);
    expect(holdings(twap, 0.25)).toBeCloseTo(750000, 6);
  });

  it('κ = √(γσ²/η) and the sinh trajectory hits its endpoints', () => {
    expect(kappa(p)).toBeCloseTo(Math.sqrt(4 / 3), 12);
    expect(holdings(p, 0)).toBeCloseTo(p.X, 6);
    expect(holdings(p, p.T)).toBeCloseTo(0, 6);
    expect(holdings(p, 0.5)).toBeCloseTo((p.X * Math.sinh(kappa(p) * 0.5)) / Math.sinh(kappa(p)), 6);
  });

  it('closed forms match numerical integrals of η∫ẋ² and σ²∫x²', () => {
    for (const gamma of [1e-8, 1e-7, 1e-6, 1e-5]) {
      const q = { ...p, gamma };
      const E = 0.5 * q.lambda * q.X ** 2 + q.eta * integrate((t) => tradingRate(q, t) ** 2, q.T);
      const V = q.sigma ** 2 * integrate((t) => holdings(q, t) ** 2, q.T);
      expect(expectedCost(q) / E).toBeCloseTo(1, 6);
      expect(costVariance(q) / V).toBeCloseTo(1, 6);
    }
  });

  it('the sinh trajectory beats perturbed trajectories on E + γ Var', () => {
    const q = { ...p, gamma: 1e-6 };
    const best = objective(q);
    for (const eps of [-0.05, 0.05, 0.2]) {
      // x_t + ε X sin(πt/T): same endpoints.
      const x = (t: number) => holdings(q, t) + eps * q.X * Math.sin(Math.PI * t);
      const v = (t: number) => tradingRate(q, t) - eps * q.X * Math.PI * Math.cos(Math.PI * t);
      const obj = 0.5 * q.lambda * q.X ** 2 + q.eta * integrate((t) => v(t) ** 2, 1) + q.gamma * q.sigma ** 2 * integrate((t) => x(t) ** 2, 1);
      expect(obj).toBeGreaterThan(best);
    }
  });

  it('efficient frontier: more risk aversion costs more and risks less; flat at TWAP', () => {
    const f = frontier(p, [0, 1e-9, 1e-8, 1e-7, 1e-6, 1e-5]);
    for (let i = 1; i < f.length; i++) {
      expect(f[i].mean).toBeGreaterThanOrEqual(f[i - 1].mean - 1e-6);
      expect(f[i].sd).toBeLessThan(f[i - 1].sd);
    }
    // First-order free risk reduction: tiny γ cuts variance much more than it adds cost.
    const dE = f[2].mean - f[0].mean, dSd = f[0].sd - f[2].sd;
    // Along the frontier dE/dsd = −2γ·sd, so near γ = 0 the slope vanishes.
    expect(dE / dSd).toBeLessThan(0.02);
  });

  it('half-life tends to ln 2 / κ for urgent sellers', () => {
    const q = { ...p, gamma: 1e-4 };
    expect(halfLife(q) * kappa(q)).toBeCloseTo(Math.LN2, 4);
    expect(halfLife({ ...p, gamma: 0 })).toBeCloseTo(0.5, 6);
  });

  it('simulated shortfall matches the discrete mean and variance', () => {
    const q = { ...p, gamma: 1e-6 };
    const n = schedule(q, 78);
    expect(n.reduce((a, b) => a + b, 0)).toBeCloseTo(q.X, 4);
    const costs = simulateShortfall(q, n, 20000, 62);
    const m = costs.reduce((a, b) => a + b, 0) / costs.length;
    const sd = Math.sqrt(costs.reduce((a, b) => a + (b - m) ** 2, 0) / costs.length);
    const tau = q.T / 78;
    let left = q.X, v = 0;
    for (const k of n) {
      left -= k;
      v += q.sigma ** 2 * tau * left ** 2;
    }
    expect(Math.abs(m - discreteExpectedCost(q, n))).toBeLessThan((4 * Math.sqrt(v)) / Math.sqrt(costs.length));
    expect(sd / Math.sqrt(v)).toBeCloseTo(1, 1);
    // Fine slicing: the discrete cost approaches the continuous formula.
    expect(discreteExpectedCost(q, n) / expectedCost(q)).toBeCloseTo(1, 1);
    expect(simulateShortfall(q, n, 5, 1)).toEqual(simulateShortfall(q, n, 5, 1));
  });
});

describe('Chapter 63: transient impact', () => {
  const X = 1e5, T = 60, q = 5e5, N = 60, times = tradeTimes(T, N);
  const rho = Math.LN2 / 5;

  it('linear solver', () => {
    const x = solveLinear([[0, 2, 1], [1, 1, 1], [2, 1, 3]], [7, 6, 13]);
    [1, 2, 3].forEach((v, i) => expect(x[i]).toBeCloseTo(v, 12));
  });

  it('a block walks the book: X²/(2q) = $10,000, whatever the resilience', () => {
    expect(scheduleCost(blockSchedule(X, N), times, q, rho)).toBeCloseTo(10000, 8);
    expect(scheduleCost(blockSchedule(X, N), times, q, 10)).toBeCloseTo(10000, 8);
  });

  it('the dent refills exponentially between trades', () => {
    const D = dentsBefore([1000, 1000], [0, 5], 5e5, rho);
    expect(D[0]).toBe(0);
    expect(D[1]).toBeCloseTo(0.002 / 2, 12); // half-life of 5 minutes
    expect(scheduleCost([1000, 1000], [0, 5], 5e5, rho)).toBeCloseTo(1000 * 0.001 + 2 * (1000 * 1000) / (2 * 5e5), 12);
    const path = dentPath([1000], [0], 5e5, rho, 10, 4);
    expect(path[1][1]).toBeCloseTo(0.002, 12);
    expect(path[path.length - 1][1]).toBeCloseTo(0.0005, 12);
  });

  it('without resilience every schedule costs the same; with it, TWAP matches the continuous formula', () => {
    expect(scheduleCost(twapSchedule(X, N), times, q, 1e-12)).toBeCloseTo(10000, 3);
    expect(scheduleCost(twapSchedule(X, N), times, q, rho) / continuousTwapCost(X, T, q, rho)).toBeCloseTo(1, 1);
  });

  it('the optimal schedule: equal end blocks, flat middle, and the Obizhaeva–Wang cost', () => {
    const n = optimalSchedule(X, times, rho);
    expect(n.reduce((a, b) => a + b, 0)).toBeCloseTo(X, 6);
    expect(n[0]).toBeCloseTo(n[N], 6);
    expect(n[0]).toBeGreaterThan(5 * n[30]);
    for (let k = 2; k < N - 1; k++) expect(n[k]).toBeCloseTo(n[30], 3);
    const ow = obizhaevaWang(X, T, q, rho);
    expect(ow.cost).toBeCloseTo(X ** 2 / (q * (rho * T + 2)), 8);
    expect(scheduleCost(n, times, q, rho) / ow.cost).toBeCloseTo(1, 2);
    // It beats TWAP and the block, and small perturbations make it worse.
    const best = scheduleCost(n, times, q, rho);
    expect(best).toBeLessThan(scheduleCost(twapSchedule(X, N), times, q, rho));
    const bumped = n.map((v, k) => v + (k === 0 ? 500 : k === 30 ? -500 : 0));
    expect(scheduleCost(bumped, times, q, rho)).toBeGreaterThan(best);
  });

  it('Obizhaeva–Wang holds the dent constant during continuous trading', () => {
    const ow = obizhaevaWang(X, T, q, rho);
    expect(ow.dent).toBeCloseTo(ow.block / q, 12);
    // Inflow ρ·dent·q equals the trading rate.
    expect(rho * ow.dent * q).toBeCloseTo(ow.rate, 8);
    expect(2 * ow.block + ow.rate * T).toBeCloseTo(X, 6);
  });

  it('pump and dump: concave impact with exponential decay pays; linear impact never does', () => {
    const lim = -(1 - 2 * Math.exp(-1)); // buy cost e⁻¹ minus resale value 1 − e⁻¹
    expect(pumpAndDump({ X: 1, T1: 1, tau2: 1e-6, delta: 0.5, rho: 1 })).toBeCloseTo(lim, 2);
    expect(pumpAndDump({ X: 1, T1: 1, tau2: 0.01, delta: 0.5, rho: 1 })).toBeLessThan(0);
    for (const tau2 of [1, 0.1, 0.01, 1e-4]) expect(pumpAndDump({ X: 1, T1: 1, tau2, delta: 1, rho: 1 })).toBeGreaterThan(0);
    // Instant dump with linear impact: e⁻¹ − (1 − e⁻¹) + ½.
    expect(pumpAndDump({ X: 1, T1: 1, tau2: 1e-6, delta: 1, rho: 1 })).toBeCloseTo(Math.exp(-1) - (1 - Math.exp(-1)) + 0.5, 3);
  });

  it('flash impact vanishes for fast trades only when β + δ < 1', () => {
    expect(flashImpact(1, 1e-12, 0.5, 0.3)).toBeLessThan(0.01);
    expect(flashImpact(1, 1e-8, 0.5, 0.7)).toBeGreaterThan(10);
    expect(flashImpact(4, 1, 0.5, 0.5)).toBeCloseTo(4, 12);
  });
});

describe('Chapter 64: execution algorithms', () => {
  it('the volume curve sums to one and is U-shaped', () => {
    const c = volumeCurve();
    expect(c).toHaveLength(BINS);
    expect(c.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(c[0]).toBeGreaterThan(2.5 * c[39]);
    expect(c[BINS - 1]).toBeGreaterThan(2.5 * c[39]);
  });

  it('every algorithm buys exactly X; POV follows realised volume', () => {
    const { volume } = simulateDay(3, { binNoise: 0.4 });
    for (const a of ['twap', 'vwap', 'pov'] as const) expect(algoSchedule(a, 0.1, volume).reduce((x, y) => x + y, 0)).toBeCloseTo(0.1, 12);
    const pov = algoSchedule('pov', 0.1, volume);
    expect(pov[5]).toBeCloseTo(0.1 * volume[5], 12);
  });

  it('slippage against VWAP: zero when trading in proportion to volume', () => {
    const price = [0, 10, 20], volume = [1, 2, 1];
    expect(slippageVsVwap([0.1, 0.2, 0.1], price, volume)).toBeCloseTo(0, 12);
    expect(slippageVsVwap([0, 0, 1], price, volume)).toBeCloseTo(10, 12); // VWAP is 10
  });

  it('VWAP tracks its benchmark better than TWAP; without noise it is exact', () => {
    expect(trackingStudy('vwap', 0.1, 200, 5, { binNoise: 0 }).sd).toBeLessThan(1e-9);
    const vwap = trackingStudy('vwap', 0.1, 400, 5, { binNoise: 0.4 });
    const twap = trackingStudy('twap', 0.1, 400, 5, { binNoise: 0.4 });
    expect(vwap.sd).toBeLessThan(twap.sd);
    expect(Math.abs(vwap.mean)).toBeLessThan(4 * vwap.sd / Math.sqrt(400));
  });

  it('first passage: 2Φ(−δ/σ√h) without drift, and drift up makes fills rarer', () => {
    expect(hitProbability(10, 0, 10, 1)).toBeCloseTo(2 * 0.15865525393145707, 8);
    expect(hitProbability(10, 2, 10, 1)).toBeLessThan(hitProbability(10, 0, 10, 1));
    expect(hitProbability(10, -2, 10, 1)).toBeGreaterThan(hitProbability(10, 0, 10, 1));
    expect(expectedWait(1e9, 0, 10, 5)).toBeCloseTo(5, 8);
  });

  it('limit-order cost: (1 − P)s/2 + μE[τ∧h], confirmed by simulation', () => {
    const sig = 200 / Math.sqrt(390);
    const r0 = limitOrderCost(5, 10, 0, sig, 5);
    expect(r0.cost).toBeCloseTo((1 - r0.fill) * 5, 12);
    const r = limitOrderCost(5, 10, 1, sig, 5);
    const mc = simulateLimitOrder(5, 10, 1, sig, 5, 4000, 64, 20000);
    expect(Math.abs(mc - r.cost)).toBeLessThan(0.4);
    // Without drift the limit order always beats the market order; with enough drift it doesn't.
    expect(r0.cost).toBeLessThan(5);
    expect(limitOrderCost(5, 10, 4, sig, 15).cost).toBeGreaterThan(5);
  });

  it("Perold's decomposition of implementation shortfall", () => {
    const r = shortfall({ target: 10000, decision: 50, arrival: 50.1, fills: [{ qty: 4000, price: 50.2 }, { qty: 4000, price: 50.3 }], close: 50.6 });
    expect(r.delay).toBeCloseTo(800, 9);
    expect(r.execution).toBeCloseTo(400 + 800, 9);
    expect(r.opportunity).toBeCloseTo(1200, 9);
    expect(r.total).toBeCloseTo(3200, 9);
  });
});

describe('Chapter 65: executing option trades', () => {
  const rows = strikeRows();

  it('stock-tied prices move by delta', () => {
    expect(tiedPrice(2.4, 0.5, 100.4, 100)).toBeCloseTo(2.6, 12);
    expect(tiedPrice(3.1, -0.4, 99, 100)).toBeCloseTo(3.5, 12);
  });

  it('strike rows: half-spreads in vol points are dollars over vega', () => {
    expect(rows.map((r) => r.strike)).toEqual([90, 95, 100, 105, 110]);
    for (const r of rows) {
      expect(r.halfSpreadVol).toBeGreaterThan(0.2);
      expect(r.halfSpreadVol).toBeLessThan(2);
    }
    expect(rows[2].dailyVega).toBe(400000);
    expect(rows[0].dailyVega).toBeLessThan(rows[1].dailyVega);
  });

  it('allocations add up; liquidity weighting equalises impact and minimises it', () => {
    for (const m of ['atm', 'even', 'liquidity'] as const) expect(allocate(50000, rows, m).reduce((a, b) => a + b, 0)).toBeCloseTo(50000, 6);
    const liq = allocate(50000, rows, 'liquidity');
    const impacts = liq.map((q, i) => impactVol(q, rows[i]));
    for (const v of impacts) expect(v).toBeCloseTo(impacts[0], 12);
    const total = (a: number[]) => a.reduce((s, q, i) => s + q * impactVol(q, rows[i]), 0);
    expect(total(liq)).toBeLessThan(total(allocate(50000, rows, 'even')));
    expect(total(liq)).toBeLessThan(total(allocate(50000, rows, 'atm')));
    // Square-root law: four times the vega, twice the impact.
    expect(impactVol(40000, rows[2]) / impactVol(10000, rows[2])).toBeCloseTo(2, 12);
  });

  it('working the order pays about half the half-spread', () => {
    const l = ladderFraction();
    expect(l.fraction).toBeCloseTo(0.53, 2);
    expect(ladderFraction(1).fraction).toBe(1);
    // With certain fills at the mid, working is free.
    expect(ladderFraction(5, 1).fraction).toBe(0);
  });

  it('entry costs: dollars are vega times vol points; a quote costs more as size grows', () => {
    const legs = entryCost(allocate(20000, rows, 'even'), rows, 'screen');
    for (const l of legs) expect(l.dollars).toBeCloseTo(l.vega * (l.spread + l.impact), 9);
    const small = volTradePlan({ Q: 10000, allocation: 'even', method: 'rfq', edge: 1 });
    const big = volTradePlan({ Q: 100000, allocation: 'even', method: 'rfq', edge: 1 });
    expect(big.entryVol).toBeGreaterThan(small.entryVol);
  });

  it('hedging drag: a long hedger realises σ√(1 − Le)', () => {
    const le = Math.sqrt(2 / Math.PI) * (2 * 0.0002) / (0.2 * Math.sqrt(1 / 252));
    expect(hedgingDragVol(0.2, 0.0002, 1 / 252)).toBeCloseTo((0.2 - 0.2 * Math.sqrt(1 - le)) * 100, 10);
  });

  it('breakeven and P&L add up', () => {
    const p = volTradePlan({ Q: 50000, allocation: 'liquidity', method: 'work', edge: 1.5 });
    expect(p.roundTripVol).toBeCloseTo(2 * p.entryVol, 12);
    expect(p.breakevenVol).toBeCloseTo(p.roundTripVol + p.hedgeVol, 12);
    expect(p.expectedPnl).toBeCloseTo((1.5 - p.breakevenVol) * 50000, 6);
  });
});
