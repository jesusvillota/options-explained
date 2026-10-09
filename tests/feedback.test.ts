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
import { eventVariance, impliedMove, ivWithEvent, remainingShare, varianceWeight, zeroDteCall } from '../src/lib/feedback/intraday';
import { CRASH, insuredHolding, insurerGamma, maxDrawdown, rebalanceTrade, simulateCrash, spiralMultiplier } from '../src/lib/feedback/spirals';
import { closeHistogram, gammaAt, localMultiplier, pinShare, simulatePinning } from '../src/lib/feedback/pinning';

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

describe('Chapter 67: pinning', () => {
  it('gamma matches Black–Scholes and explodes at the strike as expiry nears', () => {
    const g = greeks('call', { S: 101, K: 100, T: 0.1, r: 0, sigma: 0.2 }).gamma;
    expect(gammaAt(101, 100, 0.2, 0.1)).toBeCloseTo(g, 10);
    expect(gammaAt(100, 100, 0.2, 1e-6)).toBeGreaterThan(100 * gammaAt(100, 100, 0.2, 0.1));
    expect(gammaAt(100, 100, 0.2, 0)).toBe(0);
  });

  it('long gamma freezes volatility at the strike near expiry; short gamma is floored', () => {
    const near = localMultiplier(100, 1 / 78 / 252, 50000, 4e-7);
    expect(near).toBeLessThan(0.2);
    expect(localMultiplier(104, 1 / 78 / 252, 50000, 4e-7)).toBeCloseTo(1, 3);
    expect(localMultiplier(100, 1 / 78 / 252, -50000, 4e-7)).toBe(4);
    expect(localMultiplier(100, 0.01, 0, 4e-7)).toBe(1);
  });

  it('long-gamma hedging pins closes to the strike; short-gamma hedging repels them', () => {
    const base = simulatePinning({ paths: 1500, seed: 7, contracts: 0, lambda: 4e-7 });
    expect(base.hedged).toEqual(base.free);
    const pin = simulatePinning({ paths: 1500, seed: 7, contracts: 50000, lambda: 4e-7 });
    expect(pinShare(pin.hedged, 0.25)).toBeGreaterThan(1.6 * pinShare(pin.free, 0.25));
    const anti = simulatePinning({ paths: 1500, seed: 7, contracts: -30000, lambda: 4e-7 });
    expect(pinShare(anti.hedged, 0.25)).toBeLessThan(0.5 * pinShare(anti.free, 0.25));
  });

  it('histogram shares sum to the share of closes in range', () => {
    const h = closeHistogram([99.9, 100.1, 100.3, 120], -1, 1, 8);
    expect(h.reduce((a, b) => a + b, 0)).toBeCloseTo(0.75, 12);
    expect(h[3]).toBeCloseTo(0.25, 12);
    expect(h[4]).toBeCloseTo(0.25, 12);
  });
});

describe('Chapter 68: zero-days-to-expiry options', () => {
  it('the U-shaped variance weights average to one over the day', () => {
    expect(remainingShare(0)).toBeCloseTo(1, 4);
    expect(remainingShare(1)).toBe(0);
    expect(varianceWeight(0)).toBeGreaterThan(2 * varianceWeight(0.5));
    expect(varianceWeight(1)).toBeGreaterThan(1.5 * varianceWeight(0.5));
    expect(remainingShare(0.5, false)).toBe(0.5);
  });

  it('ATM value ≈ 0.4·S·σ√τ and gamma ≈ φ(0)/(S√V) at the open', () => {
    const r = zeroDteCall(100, 100, 0.2, 0, false);
    expect(r.value).toBeCloseTo(0.3989 * 100 * 0.2 / Math.sqrt(252), 2);
    expect(r.gamma).toBeCloseTo(0.3989 / (100 * 0.2 / Math.sqrt(252)), 2);
    // Matches Black–Scholes with one day to expiry.
    const bs = greeks('call', { S: 100, K: 100, T: 1 / 252, r: 0, sigma: 0.2 });
    expect(r.gamma).toBeCloseTo(bs.gamma, 10);
  });

  it('gamma explodes at the strike into the close; theta per hour matches the value lost', () => {
    const early = zeroDteCall(100, 100, 0.2, 0.1), late = zeroDteCall(100, 100, 0.2, 0.99);
    expect(late.gamma).toBeGreaterThan(5 * early.gamma);
    // Off the strike, gamma collapses into the close instead.
    expect(zeroDteCall(101, 100, 0.2, 0.99).gamma).toBeLessThan(zeroDteCall(101, 100, 0.2, 0.5).gamma);
    // Finite-difference theta over one minute.
    const u = 0.4, du = 1 / 390;
    const fd = (zeroDteCall(100, 100, 0.2, u).value - zeroDteCall(100, 100, 0.2, u + du).value) * 60;
    expect(zeroDteCall(100, 100, 0.2, u + du / 2).thetaPerHour).toBeCloseTo(fd, 4);
    expect(zeroDteCall(101, 100, 0.2, 1).value).toBe(1);
  });

  it('event variance from two expiries', () => {
    const T1 = 3 / 252, T2 = 8 / 252;
    const v = eventVariance(0.25, T1, 0.4, T2, 0.25);
    expect(v).toBeCloseTo((0.16 - 0.0625) * T2, 12);
    // Round trip: the term structure built from v reproduces the second expiry's vol.
    expect(ivWithEvent(T2, 0.25, v, 3.5 / 252)).toBeCloseTo(0.4, 12);
    expect(ivWithEvent(T1, 0.25, v, 3.5 / 252)).toBeCloseTo(0.25, 12);
    const m = impliedMove(v);
    expect(m.sd).toBeCloseTo(Math.sqrt(v), 12);
    expect(m.expectedAbs / m.sd).toBeCloseTo(Math.sqrt(2 / Math.PI), 12);
  });
});


describe('Chapter 69: liquidity spirals', () => {
  it('spiral multiplier 1/(1 − m)', () => {
    expect(spiralMultiplier(0.5)).toBe(2);
    expect(spiralMultiplier(0)).toBe(1);
    expect(spiralMultiplier(1)).toBe(Infinity);
  });

  it('leveraged and inverse products rebalance with the move: L(L − 1) r A', () => {
    expect(rebalanceTrade(2, -0.05, 1e9)).toBeCloseTo(-1e8, 3);
    expect(rebalanceTrade(-1, -0.05, 1e9)).toBeCloseTo(-1e8, 3);
    expect(rebalanceTrade(3, 0.1, 1)).toBeCloseTo(0.6, 12);
    expect(rebalanceTrade(-2, 0.1, 1)).toBeCloseTo(0.6, 12);
    expect(rebalanceTrade(1, 0.1, 1)).toBe(0);
    // Check against the definition: exposure L·A must be restored after the day.
    const L = -1, A = 100, r = 0.2;
    const exposureAfter = L * A * (1 + r), assetsAfter = A * (1 + L * r);
    expect(L * assetsAfter - exposureAfter).toBeCloseTo(rebalanceTrade(L, r, A), 12);
  });

  it('insurers hold N(d₁) of their shares and sell as the price falls', () => {
    expect(insuredHolding(200, 1000)).toBeCloseTo(1000, 3);
    expect(insuredHolding(95, 1000)).toBeLessThan(insuredHolding(100, 1000));
    const h = 1e-3;
    expect(insurerGamma(95, 1e6)).toBeCloseTo((insuredHolding(95 + h, 1e6) - insuredHolding(95 - h, 1e6)) / (2 * h), 3);
  });

  it('crash paths: insurers deepen the fall, withdrawn liquidity deepens it further', () => {
    let none = 0, deep = 0, thin = 0;
    for (let s = 0; s < 10; s++) {
      none += maxDrawdown(simulateCrash({ seed: 200 + s, insuredShare: 0, withdrawal: 1 }).price);
      deep += maxDrawdown(simulateCrash({ seed: 200 + s, insuredShare: 0.1, withdrawal: 0 }).price);
      thin += maxDrawdown(simulateCrash({ seed: 200 + s, insuredShare: 0.1, withdrawal: 1 }).price);
    }
    expect(deep).toBeGreaterThan(none);
    expect(thin).toBeGreaterThan(1.5 * deep);
    const p = simulateCrash({ seed: 1, insuredShare: 0, withdrawal: 0 });
    expect(p.price).toHaveLength(CRASH.days * CRASH.stepsPerDay + 1);
    expect(p.sold[p.sold.length - 1]).toBe(0);
  });

  it('drawdown', () => {
    expect(maxDrawdown([100, 120, 90, 110, 60, 80])).toBeCloseTo(0.5, 12);
  });
});
