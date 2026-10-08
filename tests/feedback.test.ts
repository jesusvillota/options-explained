import { describe, expect, it } from 'vitest';
import { greeks } from '../src/lib/pricing/blackScholes';
import {
  FEEDBACK_MARKET,
  POSITIONING,
  dealerGamma,
  gammaFlip,
  gexByStrike,
  multiplier,
  realisedVol,
  simulateFeedback,
} from '../src/lib/feedback/dealerGamma';

describe('Chapter 66: dealer gamma and feedback', () => {
  const tau = FEEDBACK_MARKET.tau0;

  it('dealer gamma sums contracts × 100 × Black–Scholes gamma', () => {
    const pos = [0, 0, 0, 0, 1000, 0, 0, 0, 0];
    const g = greeks('call', { S: 100, K: 100, T: tau, r: 0, sigma: 0.2 }).gamma;
    expect(dealerGamma(100, tau, pos)).toBeCloseTo(1000 * 100 * g, 8);
    expect(gexByStrike(100, tau, pos)[4]).toBeCloseTo(1000 * 100 * g * 100 * 100 * 0.01, 6);
    expect(dealerGamma(100, 0, pos)).toBe(0);
  });

  it('presets: long and short dealers have no flip; the index book flips below spot', () => {
    expect(dealerGamma(100, tau, POSITIONING.long.positions)).toBeGreaterThan(0);
    expect(dealerGamma(100, tau, POSITIONING.short.positions)).toBeLessThan(0);
    expect(gammaFlip(tau, POSITIONING.long.positions)).toBeNull();
    const flip = gammaFlip(tau, POSITIONING.index.positions)!;
    expect(flip).toBeGreaterThan(90);
    expect(flip).toBeLessThan(100);
    expect(Math.abs(dealerGamma(flip, tau, POSITIONING.index.positions))).toBeLessThan(100);
  });

  it('the feedback multiplier is 1/(1 + λΓ), floored for stability', () => {
    expect(multiplier(4e-7, 5e5)).toBeCloseTo(1 / 1.2, 12);
    expect(multiplier(4e-7, -5e5)).toBeCloseTo(1 / 0.8, 12);
    expect(multiplier(1e-6, -1e7)).toBe(4);
  });

  it('without impact, both paths coincide; with constant gamma, vol scales by the multiplier', () => {
    const a = simulateFeedback({ seed: 1, lambda: 0, positions: POSITIONING.index.positions });
    expect(a.price).toEqual(a.fundamental);
    // Long gamma damps, short gamma amplifies, on the same shocks.
    const dt = 1 / (252 * 13);
    let damp = 0, amp = 0, base = 0;
    for (let s = 0; s < 20; s++) {
      const L = simulateFeedback({ seed: 100 + s, lambda: 4e-7, positions: POSITIONING.long.positions });
      const S = simulateFeedback({ seed: 100 + s, lambda: 4e-7, positions: POSITIONING.short.positions });
      base += realisedVol(L.fundamental, dt);
      damp += realisedVol(L.price, dt);
      amp += realisedVol(S.price, dt);
    }
    expect(damp).toBeLessThan(base);
    expect(amp).toBeGreaterThan(base);
    expect(base / 20).toBeCloseTo(0.2, 1);
  });

  it('realised volatility of a deterministic path', () => {
    const dt = 1 / 252, up = Math.exp(0.01);
    const path = [100, 100 * up, 100];
    expect(realisedVol(path, dt)).toBeCloseTo(0.01 * Math.sqrt(252), 12);
  });
});
