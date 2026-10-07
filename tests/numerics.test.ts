import { describe, expect, it } from 'vitest';
import { lognormalPdf } from '../src/lib/math/lognormal';
import { blackScholesCF } from '../src/lib/models/fourier';
import { hestonCallPrices, hestonCF, HESTON_DEFAULTS } from '../src/lib/models/heston';
import { mertonCF, mertonPrice, MERTON_DEFAULTS } from '../src/lib/models/jumps';
import { cosCallPrice, cosDensity, cumulants } from '../src/lib/numerics/cos';
import { explicitStabilityLimit, interpolate, solveBlackScholesPDE } from '../src/lib/numerics/finiteDifference';
import { longstaffSchwartz } from '../src/lib/numerics/lsm';
import { mcEuropean } from '../src/lib/numerics/monteCarlo';
import { binomialPrice } from '../src/lib/pricing/binomial';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';

describe('Monte Carlo', () => {
  const exact = price('call', DEFAULTS);

  it('converges to Black–Scholes within a few standard errors, for every technique', () => {
    for (const technique of ['plain', 'antithetic', 'control'] as const) {
      const res = mcEuropean('call', DEFAULTS, 50000, 7, technique);
      const last = res.estimate.length - 1;
      expect(Math.abs(res.estimate[last] - exact)).toBeLessThan(3.5 * res.stdError[last]);
      expect(res.n[last]).toBe(50000);
    }
  });

  it('the standard error falls like 1/√N', () => {
    const res = mcEuropean('call', DEFAULTS, 64000, 3, 'plain');
    const i1 = res.n.findIndex((n) => n >= 1000), i2 = res.n.length - 1;
    const ratio = res.stdError[i1] / res.stdError[i2];
    expect(ratio).toBeCloseTo(Math.sqrt(res.n[i2] / res.n[i1]), 0);
  });

  it('variance reduction: control variates beat antithetic, which beats plain', () => {
    const se = (t: 'plain' | 'antithetic' | 'control') => { const r = mcEuropean('call', DEFAULTS, 40000, 11, t); return r.stdError[r.stdError.length - 1]; };
    expect(se('antithetic')).toBeLessThan(se('plain'));
    expect(se('control')).toBeLessThan(0.5 * se('plain'));
  });
});

describe('COS method', () => {
  it('reproduces Black–Scholes with few terms', () => {
    for (const K of [80, 100, 120]) {
      const cos = cosCallPrice(blackScholesCF(0.2, 1), 100, K, 1, 0.05, 0, 64);
      expect(cos).toBeCloseTo(price('call', { ...DEFAULTS, K }), 8);
    }
  });

  it('matches the Heston and Merton Fourier prices', () => {
    const T = 1, r = 0.03;
    const phiH = hestonCF(HESTON_DEFAULTS, T);
    expect(cosCallPrice(phiH, 100, 110, T, r, 0, 256)).toBeCloseTo(hestonCallPrices(HESTON_DEFAULTS, 100, [110], T, r)[0], 5);
    expect(cosCallPrice(mertonCF(MERTON_DEFAULTS, T), 100, 90, T, r, 0, 256)).toBeCloseTo(mertonPrice('call', 100, 90, T, r, MERTON_DEFAULTS), 6);
  });

  it('the error falls exponentially with the number of terms', () => {
    const exact = price('call', DEFAULTS);
    const err = (n: number) => Math.abs(cosCallPrice(blackScholesCF(0.2, 1), 100, 100, 1, 0.05, 0, n) - exact);
    expect(err(16)).toBeGreaterThan(1e-4);
    expect(err(32)).toBeLessThan(err(16) / 100);
  });

  it('rebuilds the density from its cosine series', () => {
    const phi = blackScholesCF(0.2, 1);
    // y = ln(S_T/F) ~ N(−σ²/2, σ²): compare with the lognormal density of S_T via the change of variables.
    const F = 100 * Math.exp(0.05);
    for (const ST of [80, 105, 130]) {
      const y = Math.log(ST / F);
      expect(cosDensity(phi, y, 128) / ST).toBeCloseTo(lognormalPdf(ST, { S0: 100, mu: 0.05, sigma: 0.2, T: 1 }), 8);
    }
    const { c1, c2 } = cumulants(phi);
    expect(c1).toBeCloseTo(-0.02, 6);
    expect(c2).toBeCloseTo(0.04, 5);
  });
});

describe('Longstaff–Schwartz', () => {
  it('prices an American put close to the binomial tree, and above the European', () => {
    const input = { S: 100, K: 100, T: 1, r: 0.06, sigma: 0.2 };
    const lsm = longstaffSchwartz({ ...input, steps: 50, paths: 20000, seed: 5 });
    const tree = binomialPrice('put', { ...input, steps: 1000, american: true });
    expect(Math.abs(lsm.price - tree)).toBeLessThan(3 * lsm.stdError + 0.03);
    expect(lsm.price).toBeGreaterThan(lsm.european + 0.1);
  });

  it('matches the Longstaff–Schwartz paper (S = 36, K = 40, σ = 20%, T = 1, r = 6%): about 4.47', () => {
    const lsm = longstaffSchwartz({ S: 36, K: 40, T: 1, r: 0.06, sigma: 0.2, steps: 50, paths: 20000, seed: 9 });
    expect(lsm.price).toBeCloseTo(4.47, 1);
  });

  it('finds an exercise boundary that rises towards the strike near expiry', () => {
    const { snapshots } = longstaffSchwartz({ S: 100, K: 100, T: 1, r: 0.06, sigma: 0.2, steps: 20, paths: 20000, seed: 2 });
    const early = snapshots[5].boundary, late = snapshots[snapshots.length - 1].boundary; // very early dates may have no in-the-money paths below the boundary (NaN)
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThan(100);
  });
});

describe('finite differences', () => {
  const base = { type: 'call' as const, K: 100, r: 0.05, sigma: 0.2, T: 1, nS: 80 };
  const exact = price('call', DEFAULTS);
  const at100 = (r: ReturnType<typeof solveBlackScholesPDE>) => interpolate(r.S, r.V[r.V.length - 1], 100);

  it('the explicit scheme converges below its stability limit and explodes above it', () => {
    const limit = explicitStabilityLimit(base);
    const stableSteps = Math.ceil(base.T / limit) + 1;
    const stable = solveBlackScholesPDE({ ...base, nT: stableSteps, theta: 0 });
    expect(Math.abs(at100(stable) - exact)).toBeLessThan(0.1);
    const unstable = solveBlackScholesPDE({ ...base, nT: Math.floor(stableSteps * 0.8), theta: 0 });
    expect(Math.max(...unstable.V[unstable.V.length - 1].map(Math.abs))).toBeGreaterThan(1e6);
  });

  it('implicit is first order in time; Crank–Nicolson with Rannacher start-up is second order', () => {
    const errs = (theta: number, rannacher = false) => [5, 10, 20].map((nT) => Math.abs(at100(solveBlackScholesPDE({ ...base, nS: 800, Smax: 400, nT, theta, rannacher })) - exact)); // coarse enough that the spatial error floor (~6e-4) is negligible
    const imp = errs(1), cn = errs(0.5, true);
    expect(imp[0] / imp[1]).toBeGreaterThan(1.7); // first order: the error halves
    expect(imp[0] / imp[1]).toBeLessThan(2.3);
    expect(cn[0] / cn[1]).toBeGreaterThan(3.5); // second order: the error quarters
    expect(cn[2]).toBeLessThan(imp[2] / 10);
  });
});
