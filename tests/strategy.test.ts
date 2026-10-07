import { describe, expect, it } from 'vitest';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import {
  breakevens, kinks, makeLeg, netCost, PRESETS, profitRange, slopeAtInfinity, strategyPayoff, strategyProfit, type StrategyLeg,
} from '../src/lib/pricing/strategy';

const c100 = price('call', DEFAULTS);
const p100 = price('put', DEFAULTS);

describe('single legs', () => {
  it('matches the long call: breakeven K + C, loss capped at the premium, unlimited upside', () => {
    const legs = [makeLeg('call', 'long', 100)];
    expect(breakevens(legs)[0]).toBeCloseTo(100 + c100, 10);
    const r = profitRange(legs);
    expect(r.maxProfit).toBe(Infinity);
    expect(r.minProfit).toBeCloseTo(-c100, 10);
  });

  it('caps the long put\'s gain at K − P (stock at zero)', () => {
    const r = profitRange([makeLeg('put', 'long', 100)]);
    expect(r.maxProfit).toBeCloseTo(100 - p100, 10);
  });

  it('treats stock as a slope-1 line through its purchase price', () => {
    const legs = [makeLeg('stock', 'long')];
    expect(strategyProfit(legs, 130)).toBeCloseTo(30, 12);
    expect(breakevens(legs)).toEqual([100]);
    expect(profitRange(legs)).toEqual({ maxProfit: Infinity, minProfit: -100 });
  });
});

describe('combinations', () => {
  it('adds payoffs leg by leg', () => {
    const legs = PRESETS['long-straddle'].legs();
    for (const s of [60, 100, 140]) expect(strategyPayoff(legs, s)).toBeCloseTo(Math.abs(s - 100), 12);
    expect(netCost(legs)).toBeCloseTo(c100 + p100, 12);
    const [lo, hi] = breakevens(legs);
    expect(lo).toBeCloseTo(100 - c100 - p100, 10);
    expect(hi).toBeCloseTo(100 + c100 + p100, 10);
  });

  it('builds the butterfly tent from calls: +1, −2, +1', () => {
    const legs = PRESETS['long-butterfly'].legs();
    expect(kinks(legs)).toEqual([90, 100, 110]);
    expect(strategyPayoff(legs, 80)).toBe(0);
    expect(strategyPayoff(legs, 100)).toBeCloseTo(10, 12);
    expect(strategyPayoff(legs, 120)).toBeCloseTo(0, 12);
    expect(slopeAtInfinity(legs)).toBe(0);
    const r = profitRange(legs);
    expect(r.maxProfit).toBeCloseTo(10 - netCost(legs), 10);
    expect(r.minProfit).toBeCloseTo(-netCost(legs), 10);
    expect(netCost(legs)).toBeGreaterThan(0); // a butterfly costs money: its payoff is never negative
  });

  it('caps both sides of a bull call spread', () => {
    const legs = PRESETS['bull-call-spread'].legs();
    const cost = netCost(legs);
    const r = profitRange(legs);
    expect(r.maxProfit).toBeCloseTo(15 - cost, 10);
    expect(r.minProfit).toBeCloseTo(-cost, 10);
    expect(breakevens(legs)[0]).toBeCloseTo(100 + cost, 10);
  });

  it('gives a short straddle unlimited loss on the upside', () => {
    const r = profitRange(PRESETS['short-straddle'].legs());
    expect(r.minProfit).toBe(-Infinity);
    expect(r.maxProfit).toBeCloseTo(c100 + p100, 10);
  });

  it('turns stock + put into a call-like payoff (protective put)', () => {
    const legs = PRESETS['protective-put'].legs();
    // Below the put strike the loss is locked in; above, it moves 1:1 with the stock.
    expect(strategyProfit(legs, 50)).toBeCloseTo(strategyProfit(legs, 80), 12);
    expect(strategyProfit(legs, 130) - strategyProfit(legs, 120)).toBeCloseTo(10, 12);
  });

  it('finds no breakeven for a position that never crosses zero', () => {
    const legs: StrategyLeg[] = [{ kind: 'call', side: 'long', quantity: 1, strike: 100, premium: 0 }];
    // Free call: profit is 0 on [0, 100] (flat, skipped) and positive above.
    expect(breakevens(legs)).toEqual([100]);
  });

  it('has a sensible view and at least one leg for every preset', () => {
    for (const p of Object.values(PRESETS)) {
      expect(p.view.length).toBeGreaterThan(10);
      expect(p.legs().length).toBeGreaterThan(0);
    }
  });
});
