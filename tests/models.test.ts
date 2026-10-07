import { describe, expect, it } from 'vitest';
import { c } from '../src/lib/math/complex';
import { price } from '../src/lib/pricing/blackScholes';
import { blackScholesCF, lewisCallPrice, lewisCallPrices } from '../src/lib/models/fourier';
import { fellerHolds, HESTON_DEFAULTS, hestonCallPrices, hestonCF, hestonPath, hestonSmile, hestonVarianceSwap } from '../src/lib/models/heston';
import { dupireForward, dupirePrice, localVolPath, ssviLocalVol } from '../src/lib/models/localVol';
import { smilePrice } from '../src/lib/vol/density';
import { EQUITY_SSVI, ssviVol } from '../src/lib/vol/smile';
import { KOU_DEFAULTS, kouCF, MERTON_DEFAULTS, mertonCF, mertonLogDensity, mertonPath, mertonPrice } from '../src/lib/models/jumps';

describe('Fourier pricing (Lewis)', () => {
  it('reproduces Black–Scholes from its characteristic function', () => {
    for (const K of [70, 100, 130]) {
      for (const T of [0.1, 1, 3]) {
        const fourier = lewisCallPrice(blackScholesCF(0.25, T), 100, K, T, 0.05, 0.02);
        expect(fourier).toBeCloseTo(price('call', { S: 100, K, T, r: 0.05, q: 0.02, sigma: 0.25 }), 6);
      }
    }
  });

  it('characteristic functions are martingales: φ(−i) = 1 and φ(0) = 1', () => {
    for (const phi of [hestonCF(HESTON_DEFAULTS, 1), mertonCF(MERTON_DEFAULTS, 1), kouCF(KOU_DEFAULTS, 1)]) {
      expect(phi(c(0, -1)).re).toBeCloseTo(1, 10);
      expect(phi(c(0, 0)).re).toBeCloseTo(1, 12);
    }
  });
});

describe('Heston', () => {
  it('matches the Fang–Oosterlee (2008) reference value 5.785155450', () => {
    const p = { v0: 0.0175, kappa: 1.5768, theta: 0.0398, xi: 0.5751, rho: -0.5711 };
    expect(hestonCallPrices(p, 100, [100], 1, 0, 0)[0]).toBeCloseTo(5.785155450, 5);
    expect(fellerHolds(p)).toBe(false);
  });

  it('collapses to Black–Scholes when the variance is constant', () => {
    const p = { v0: 0.04, kappa: 1, theta: 0.04, xi: 1e-4, rho: 0 };
    const prices = hestonCallPrices(p, 100, [80, 100, 120], 1, 0.05);
    [80, 100, 120].forEach((K, i) => expect(prices[i]).toBeCloseTo(price('call', { S: 100, K, T: 1, r: 0.05, sigma: 0.2 }), 5));
  });

  it('negative correlation produces a downward skew; zero correlation a smile', () => {
    const skew = hestonSmile(HESTON_DEFAULTS, 100, [80, 100, 120], 0.5, 0.05);
    expect(skew[0]).toBeGreaterThan(skew[1]);
    expect(skew[1]).toBeGreaterThan(skew[2]);
    const sym = hestonSmile({ ...HESTON_DEFAULTS, rho: 0 }, 100, [80, 100 * Math.exp(0.025), 125], 0.5, 0.05);
    expect(sym[0]).toBeGreaterThan(sym[1]);
    expect(sym[2]).toBeGreaterThan(sym[1]);
  });

  it('prices short maturities stably: the at-the-money implied vol tends to √v₀', () => {
    const [week] = hestonSmile(HESTON_DEFAULTS, 100, [100], 1 / 52, 0);
    const [day] = hestonSmile(HESTON_DEFAULTS, 100, [100], 1 / 365, 0);
    expect(Math.abs(week - 0.2)).toBeLessThan(0.003);
    expect(Math.abs(day - 0.2)).toBeLessThan(Math.abs(week - 0.2) + 1e-4);
  });

  it('agrees with a Monte Carlo simulation of the SDE', () => {
    const T = 1, r = 0.03, K = 105, N = 4000;
    const payoffs = Array.from({ length: N }, (_, i) => Math.max(hestonPath(i + 1, 100, r, HESTON_DEFAULTS, T, 200).S[200] - K, 0) * Math.exp(-r * T));
    const mean = payoffs.reduce((a, b) => a + b, 0) / N;
    const se = Math.sqrt(payoffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1) / N);
    const exact = hestonCallPrices(HESTON_DEFAULTS, 100, [K], T, r)[0];
    expect(Math.abs(mean - exact)).toBeLessThan(3 * se + 0.05);
  });
});

describe('jumps', () => {
  it('Merton with no jumps is Black–Scholes', () => {
    const p = { ...MERTON_DEFAULTS, lambda: 0 };
    expect(mertonPrice('call', 100, 110, 1, 0.05, p)).toBeCloseTo(price('call', { S: 100, K: 110, T: 1, r: 0.05, sigma: 0.15 }), 12);
  });

  it("Merton's series agrees with Fourier pricing of its characteristic function", () => {
    const strikes = [70, 90, 100, 110, 140];
    const viaCF = lewisCallPrices(mertonCF(MERTON_DEFAULTS, 0.5), 100, strikes, 0.5, 0.05);
    strikes.forEach((K, i) => expect(mertonPrice('call', 100, K, 0.5, 0.05, MERTON_DEFAULTS)).toBeCloseTo(viaCF[i], 6));
  });

  it('Merton satisfies put–call parity', () => {
    const C = mertonPrice('call', 100, 95, 1, 0.05, MERTON_DEFAULTS);
    const P = mertonPrice('put', 100, 95, 1, 0.05, MERTON_DEFAULTS);
    expect(C - P).toBeCloseTo(100 - 95 * Math.exp(-0.05), 10);
  });

  it('the Merton log-density integrates to 1 and has the right mean', () => {
    let mass = 0, mean = 0;
    const dx = 0.001;
    for (let x = -3; x <= 3; x += dx) {
      const f = mertonLogDensity(x, 1, 0.08, MERTON_DEFAULTS);
      mass += f * dx;
      mean += x * f * dx;
    }
    expect(mass).toBeCloseTo(1, 6);
    const kbar = Math.exp(-0.1 + 0.005) - 1;
    expect(mean).toBeCloseTo(0.08 - 0.5 * kbar - 0.5 * 0.0225 + 0.5 * -0.1, 5);
  });

  it('Kou prices are between the no-arbitrage bounds and above Black–Scholes at the diffusion vol', () => {
    const [atm] = lewisCallPrices(kouCF(KOU_DEFAULTS, 1), 100, [100], 1, 0.05);
    expect(atm).toBeGreaterThan(price('call', { S: 100, K: 100, T: 1, r: 0.05, sigma: 0.15 }));
    expect(atm).toBeLessThan(100);
  });

  it('simulated Merton paths jump at about rate λ', () => {
    let count = 0;
    for (let s = 1; s <= 200; s++) count += mertonPath(s, 100, 0.05, { ...MERTON_DEFAULTS, lambda: 3 }, 1, 252).jumps.length;
    expect(count / 200).toBeGreaterThan(2.6);
    expect(count / 200).toBeLessThan(3.4);
  });
});

describe('local volatility', () => {
  it('a flat implied surface has a flat local vol, and Dupire’s equation then reproduces Black–Scholes', () => {
    const flat = ssviLocalVol({ atmVol: 0.2, rho: 0, eta: 0 }, 100, 0.05);
    expect(flat(80, 0.5)).toBeCloseTo(0.2, 6);
    expect(flat(130, 1)).toBeCloseTo(0.2, 6);
    const grid = dupireForward(100, 0.05, 0, flat, 1);
    for (const K of [80, 100, 120]) expect(dupirePrice(grid, K)).toBeCloseTo(price('call', { S: 100, K, T: 1, r: 0.05, sigma: 0.2 }), 2);
  });

  it('the local vol of an SSVI surface reprices the surface through Dupire’s forward equation', () => {
    const lv = ssviLocalVol(EQUITY_SSVI, 100, 0.05);
    const grid = dupireForward(100, 0.05, 0, lv, 1, { nK: 300, nT: 200 });
    for (const K of [80, 90, 100, 110, 120]) {
      const target = smilePrice('call', K, { S: 100, K, T: 1, r: 0.05 }, (k) => ssviVol(k, 1, EQUITY_SSVI));
      expect(Math.abs(dupirePrice(grid, K) - target)).toBeLessThan(0.03);
    }
  });

  it('near the money, local skew is about twice the implied skew', () => {
    const T = 0.1, F = 100 * Math.exp(0.05 * T), h = 0.01;
    const lv = ssviLocalVol(EQUITY_SSVI, 100, 0.05);
    const localSkew = (lv(F * Math.exp(h), T) - lv(F * Math.exp(-h), T)) / (2 * h);
    const impliedSkew = (ssviVol(h, T, EQUITY_SSVI) - ssviVol(-h, T, EQUITY_SSVI)) / (2 * h);
    expect(localSkew / impliedSkew).toBeGreaterThan(1.7);
    expect(localSkew / impliedSkew).toBeLessThan(2.3);
  });

  it('Monte Carlo under local vol reprices an out-of-the-money put on the surface', () => {
    const lv = ssviLocalVol(EQUITY_SSVI, 100, 0.05);
    const N = 3000, K = 90;
    const pay = Array.from({ length: N }, (_, i) => Math.max(K - localVolPath(i + 1, 100, 0.05, lv, 1, 100).S[100], 0) * Math.exp(-0.05));
    const mean = pay.reduce((a, b) => a + b, 0) / N;
    const se = Math.sqrt(pay.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1) / N);
    const target = smilePrice('put', K, { S: 100, K, T: 1, r: 0.05 }, (k) => ssviVol(k, 1, EQUITY_SSVI));
    expect(Math.abs(mean - target)).toBeLessThan(3 * se + 0.05);
  });
});

describe('Heston and variance swaps', () => {
  it('the model-free strip of Heston option prices gives the expected average variance', () => {
    const p = { v0: 0.06, kappa: 1.5, theta: 0.03, xi: 0.6, rho: -0.6 };
    const T = 0.75, r = 0.02, S = 100, F = S * Math.exp(r * T);
    // Strikes on a fine log grid; out-of-the-money prices from the Fourier pricer and parity.
    const n = 1600, kMin = -3, kMax = 2;
    const ks = Array.from({ length: n + 1 }, (_, i) => kMin + ((kMax - kMin) * i) / n);
    const Ks = ks.map((k) => F * Math.exp(k));
    const calls = hestonCallPrices(p, S, Ks, T, r);
    let integral = 0;
    ks.forEach((k, i) => {
      const K = Ks[i];
      const Q = k < 0 ? calls[i] - S + K * Math.exp(-r * T) : calls[i];
      const w = i === 0 || i === n ? 0.5 : 1;
      integral += (w * Q * Math.exp(-k)) / F; // dK/K² = e^{−k}dk/F
    });
    const kVar = ((2 * Math.exp(r * T)) / T) * integral * ((kMax - kMin) / n);
    expect(kVar).toBeCloseTo(hestonVarianceSwap(p, T), 4);
  });
});
