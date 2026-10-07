import { describe, expect, it } from 'vitest';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import { boxValue, callFromPut, impliedForward, parityGap, parityTrade, putFromCall } from '../src/lib/pricing/parity';
import { forwardPrice } from '../src/lib/pricing/rates';
import { PRESETS, strategyPayoff } from '../src/lib/pricing/strategy';

describe('put–call parity', () => {
  it('holds exactly for Black–Scholes prices', () => {
    for (const K of [70, 100, 130]) {
      const input = { ...DEFAULTS, K, q: 0.02 };
      expect(parityGap(price('call', input), price('put', input), input)).toBeCloseTo(0, 12);
    }
  });

  it('turns a call price into a put price and back', () => {
    const input = { S: 100, K: 100, r: 0.05, T: 1 };
    expect(putFromCall(10.4506, input)).toBeCloseTo(5.5735, 4);
    expect(callFromPut(5.5735, input)).toBeCloseTo(10.4506, 4);
  });

  it('reveals the forward price', () => {
    const c = price('call', { ...DEFAULTS, K: 90 });
    const p = price('put', { ...DEFAULTS, K: 90 });
    expect(impliedForward(c, p, 90, DEFAULTS.r, DEFAULTS.T)).toBeCloseTo(forwardPrice(DEFAULTS), 10);
  });

  it('names the conversion or reversal', () => {
    const input = { S: 100, K: 100, r: 0.05, T: 1 };
    expect(parityTrade(12, 5.5735, input)).toMatchObject({ kind: 'conversion' });
    expect(parityTrade(9, 5.5735, input).kind).toBe('reversal');
    expect(parityTrade(12, 5.5735, input).profitToday).toBeCloseTo(12 - 10.4506, 3);
  });

  it('prices a box spread as a bond', () => {
    const c = (K: number) => price('call', { ...DEFAULTS, K });
    const p = (K: number) => price('put', { ...DEFAULTS, K });
    const box = c(90) - c(110) + p(110) - p(90);
    expect(box).toBeCloseTo(boxValue(90, 110, DEFAULTS.r, DEFAULTS.T), 10);
  });

  it('makes a long call + short put pay like a forward', () => {
    const legs = PRESETS['synthetic-forward'].legs();
    for (const s of [50, 100, 160]) expect(strategyPayoff(legs, s)).toBeCloseTo(s - 100, 12);
  });
});
