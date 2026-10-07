import { describe, expect, it } from 'vitest';
import { lognormalCdf, lognormalPdf } from '../src/lib/math/lognormal';
import { gbmPath, gbmPathVariableVol } from '../src/lib/math/rng';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import { butterflyDensity, impliedDensity, impliedTailProbability, smilePrice } from '../src/lib/vol/density';
import { bisectionBrackets, brennerSubrahmanyam, historicalVol, historicalVolStdError, rollingVol, impliedVol, manasterKoehlerGuess, newtonIterates, priceBounds } from '../src/lib/vol/impliedVol';
import { atmTotalVariance, densityFactor, EQUITY_SSVI, forwardDelta, logMoneynessForDelta, smileQuotes, ssviButterflyFree, ssviTotalVariance, ssviVol, sviTotalVariance } from '../src/lib/vol/smile';
import { fairVariance, logContractPayoff, stripPayoff, strikeSpacings, vixVariance } from '../src/lib/vol/varianceSwap';

const market = { S: 100, K: 100, T: 1, r: 0.05, q: 0 };

describe('implied volatility', () => {
  it('matches Hull’s example: S = 21, K = 20, r = 10%, T = 3 months, C = 1.875 → σ ≈ 23.5%', () => {
    const iv = impliedVol('call', 1.875, { S: 21, K: 20, r: 0.1, T: 0.25 });
    expect(iv.sigma).toBeCloseTo(0.2345, 3);
    expect(iv.method).toBe('newton');
  });

  it('round-trips Black–Scholes prices for calls and puts across strikes', () => {
    for (const type of ['call', 'put'] as const) {
      for (const K of [60, 80, 100, 120, 160]) {
        for (const sigma of [0.05, 0.2, 0.6]) {
          const m = { ...market, K, q: 0.02 };
          const p = price(type, { ...m, sigma });
          const [lo] = priceBounds(type, m);
          if (p - lo < 1e-6) continue; // no time value left: σ isn't identifiable
          expect(impliedVol(type, p, m).sigma).toBeCloseTo(sigma, 6);
        }
      }
    }
  });

  it('returns NaN outside the no-arbitrage bounds', () => {
    const [lo, hi] = priceBounds('call', market);
    expect(lo).toBeCloseTo(100 - 100 * Math.exp(-0.05), 10);
    expect(hi).toBe(100);
    expect(impliedVol('call', lo - 0.01, market).sigma).toBeNaN();
    expect(impliedVol('call', 100.5, market).sigma).toBeNaN();
  });

  it('Newton from the Manaster–Koehler guess converges monotonically and fast', () => {
    const m = { ...market, K: 120 };
    const target = price('call', { ...m, sigma: 0.25 });
    const xs = newtonIterates('call', target, m, manasterKoehlerGuess(m));
    expect(xs[xs.length - 1]).toBeCloseTo(0.25, 9);
    expect(xs.length).toBeLessThan(10);
    const diffs = xs.slice(1).map((x, i) => x - xs[i]);
    expect(diffs.every((d) => d <= 1e-12) || diffs.every((d) => d >= -1e-12)).toBe(true);
  });

  it('bisection halves its bracket each step and keeps the root inside', () => {
    const target = price('call', { ...market, sigma: 0.3 });
    const br = bisectionBrackets('call', target, market, 0.01, 1, 20);
    expect(br[20][1] - br[20][0]).toBeCloseTo(0.99 / 2 ** 20, 12);
    expect(br[20][0]).toBeLessThanOrEqual(0.3);
    expect(br[20][1]).toBeGreaterThanOrEqual(0.3);
  });

  it('historical volatility recovers the true σ from a long GBM sample', () => {
    const path = gbmPath(7, 100, 0.1, 0.3, 40, 40 * 252);
    expect(historicalVol(path)).toBeCloseTo(0.3, 2);
  });

  it('a one-year estimate scatters by about σ/√(2n) around the truth', () => {
    const est = Array.from({ length: 400 }, (_, i) => historicalVol(gbmPath(100 + i, 100, 0.05, 0.2, 1, 252)));
    const mean = est.reduce((a, b) => a + b, 0) / est.length;
    const sd = Math.sqrt(est.reduce((a, b) => a + (b - mean) ** 2, 0) / est.length);
    expect(mean).toBeCloseTo(0.2, 2);
    expect(sd / historicalVolStdError(0.2, 252)).toBeGreaterThan(0.85);
    expect(sd / historicalVolStdError(0.2, 252)).toBeLessThan(1.15);
  });

  it('a rolling window picks up a change of regime', () => {
    const sigmas = [...Array(500).fill(0.1), ...Array(500).fill(0.4)];
    const path = gbmPathVariableVol(3, 100, 0, sigmas, 1 / 252);
    const roll = rollingVol(path, 60);
    expect(roll[59]).toBeNaN();
    expect(roll[490]).toBeLessThan(0.15); // 60 returns: standard error ≈ σ/√120
    expect(roll[990]).toBeGreaterThan(0.3);
  });

  it('Brenner–Subrahmanyam is close for an option struck at the forward', () => {
    const F = 100 * Math.exp(0.05);
    const C = price('call', { ...market, K: F, sigma: 0.2 }) * Math.exp(0.05); // undiscounted
    expect(brennerSubrahmanyam(C, F, 1)).toBeCloseTo(0.2, 2);
  });
});

describe('smiles', () => {
  it('SSVI has the chosen at-the-money volatility at every maturity', () => {
    for (const T of [0.1, 0.5, 2]) expect(ssviVol(0, T, EQUITY_SSVI)).toBeCloseTo(EQUITY_SSVI.atmVol, 12);
  });

  it('SSVI with negative ρ has a downward skew', () => {
    expect(ssviVol(-0.2, 0.5, EQUITY_SSVI)).toBeGreaterThan(ssviVol(0, 0.5, EQUITY_SSVI));
    expect(ssviVol(0.2, 0.5, EQUITY_SSVI)).toBeLessThan(ssviVol(-0.2, 0.5, EQUITY_SSVI));
  });

  it('SSVI total variance increases with maturity (no calendar arbitrage)', () => {
    for (const k of [-0.5, -0.1, 0, 0.1, 0.5]) {
      expect(ssviTotalVariance(k, 1, EQUITY_SSVI)).toBeGreaterThan(ssviTotalVariance(k, 0.5, EQUITY_SSVI));
    }
  });

  it('an inverted term structure blends from the short to the long at-the-money vol, with θ increasing', () => {
    const p = { ...EQUITY_SSVI, atmVol: 0.2, atmVolShort: 0.35 };
    expect(ssviVol(0, 0.001, p)).toBeCloseTo(0.35, 2);
    expect(ssviVol(0, 30, p)).toBeCloseTo(0.2, 1);
    for (let T = 0.05; T < 5; T += 0.05) expect(atmTotalVariance(T + 0.05, p)).toBeGreaterThan(atmTotalVariance(T, p));
  });

  it('delta conventions: the 25-delta call strike has call delta 0.25, and equity risk reversals are negative', () => {
    const w = (k: number) => ssviTotalVariance(k, 0.25, EQUITY_SSVI);
    const k = logMoneynessForDelta(0.25, w);
    expect(forwardDelta(k, w(k))).toBeCloseTo(0.25, 10);
    const q = smileQuotes(0.25, EQUITY_SSVI);
    expect(q.atm).toBeCloseTo(0.2, 12);
    expect(q.rr25).toBeLessThan(-0.02);
    expect(q.bf25).toBeGreaterThan(0);
    const flat = smileQuotes(0.25, { atmVol: 0.2, rho: 0, eta: 1e-9 });
    expect(flat.rr25).toBeCloseTo(0, 6);
    expect(flat.bf25).toBeCloseTo(0, 6);
  });

  it('raw SVI with b = 0 is flat', () => {
    expect(sviTotalVariance(0.3, { a: 0.04, b: 0, rho: -0.5, m: 0, s: 0.1 })).toBe(0.04);
  });

  it('the density factor g is positive for the default surface and negative when the wings are too steep', () => {
    const w = (k: number) => ssviTotalVariance(k, 0.5, EQUITY_SSVI);
    expect(ssviButterflyFree(EQUITY_SSVI, 0.5)).toBe(true);
    for (let k = -1; k <= 1; k += 0.05) expect(densityFactor(w, k)).toBeGreaterThan(0);
    const steep = { atmVol: 0.2, rho: -0.9, eta: 3 };
    expect(ssviButterflyFree(steep, 0.5)).toBe(false);
    const ws = (k: number) => ssviTotalVariance(k, 0.5, steep);
    const gs = Array.from({ length: 81 }, (_, i) => densityFactor(ws, -1 + i * 0.025));
    expect(Math.min(...gs)).toBeLessThan(0);
  });

  it('forward delta is ½ just above the money and falls with strike', () => {
    expect(forwardDelta(0.02, 0.04)).toBeCloseTo(0.5, 2);
    expect(forwardDelta(0.3, 0.04)).toBeLessThan(forwardDelta(0, 0.04));
  });
});

describe('densities from prices (Breeden–Litzenberger)', () => {
  const flat = () => 0.2;
  const ln = { S0: 100, mu: 0.05, sigma: 0.2, T: 1 };

  it('a flat smile gives back the lognormal density', () => {
    for (const K of [70, 90, 100, 110, 140]) {
      expect(impliedDensity(K, market, flat)).toBeCloseTo(lognormalPdf(K, ln), 5);
    }
  });

  it('wide butterflies smear the density; narrow ones converge', () => {
    const c = (K: number) => price('call', { ...DEFAULTS, K });
    const exact = lognormalPdf(100, ln);
    const errWide = Math.abs(butterflyDensity(c, 100, 20, 0.05, 1) - exact);
    const errNarrow = Math.abs(butterflyDensity(c, 100, 1, 0.05, 1) - exact);
    expect(errNarrow).toBeLessThan(errWide / 50);
  });

  it('the slope of call prices gives Q(S_T > K)', () => {
    expect(impliedTailProbability(110, market, flat)).toBeCloseTo(1 - lognormalCdf(110, ln), 6);
  });

  it('a skewed smile fattens the left tail', () => {
    const skew = (k: number) => ssviVol(k, 1, EQUITY_SSVI);
    expect(impliedDensity(50, market, skew)).toBeGreaterThan(10 * impliedDensity(50, market, flat));
    // and the density still integrates to about 1
    let total = 0;
    for (let K = 20; K <= 300; K += 0.5) total += impliedDensity(K, market, skew) * 0.5;
    expect(total).toBeCloseTo(1, 2);
    const F = 100 * Math.exp(0.05); // at the forward, k = 0 and the smile gives the at-the-money vol
    expect(smilePrice('call', F, market, skew)).toBeCloseTo(price('call', { ...market, K: F, sigma: 0.2 }), 10);
  });
});

describe('variance swaps', () => {
  const flat = () => 0.2;

  it('the strip of 1/K² options replicates the log-contract payoff', () => {
    const strikes = Array.from({ length: 1001 }, (_, i) => 20 + i * 0.25);
    for (const ST of [60, 90, 105, 150]) expect(stripPayoff(ST, 105, strikes)).toBeCloseTo(logContractPayoff(ST, 105), 4);
  });

  it('strike spacings follow the VIX convention', () => {
    expect(strikeSpacings([90, 95, 100, 110])).toEqual([5, 5, 7.5, 10]);
  });

  it('under a flat smile the fair variance is σ²', () => {
    expect(fairVariance(market, flat)).toBeCloseTo(0.04, 5);
  });

  it('the VIX formula on a dense strike grid also gives σ²', () => {
    const strikes = Array.from({ length: 561 }, (_, i) => 20 + i * 0.5);
    expect(vixVariance(market, flat, strikes)).toBeCloseTo(0.04, 4);
  });

  it('a skew raises the fair variance above the at-the-money variance', () => {
    const skew = (k: number) => ssviVol(k, 1, EQUITY_SSVI);
    expect(fairVariance(market, skew)).toBeGreaterThan(0.04);
  });
});
