import { describe, expect, it } from 'vitest';
import { optionChain, quoteAround, tickSize } from '../src/lib/market/optionChain';
import { DEFAULTS } from '../src/lib/pricing/blackScholes';

const strikes = [80, 85, 90, 95, 100, 105, 110, 115, 120];
const onTick = (x: number, tick: number) => Math.abs(x / tick - Math.round(x / tick)) < 1e-9;

describe('quotes', () => {
  it('uses $0.05 ticks below $3 and $0.10 above', () => {
    expect(tickSize(2.99)).toBe(0.05);
    expect(tickSize(3)).toBe(0.1);
  });

  it('brackets the theoretical value with a bid below and an ask above, on the tick grid', () => {
    for (const theo of [0.01, 0.37, 2.9, 3.4, 10.45, 27.8]) {
      const { bid, ask } = quoteAround(theo);
      expect(bid).toBeGreaterThanOrEqual(0);
      expect(bid).toBeLessThanOrEqual(theo);
      expect(ask).toBeGreaterThan(theo);
      expect(onTick(bid, 0.05)).toBe(true);
      expect(onTick(ask, 0.05)).toBe(true);
    }
  });
});

describe('option chain', () => {
  const chain = optionChain({ ...DEFAULTS, T: 0.25, strikes, seed: 7 });

  it('is deterministic for a given seed', () => {
    expect(optionChain({ ...DEFAULTS, T: 0.25, strikes, seed: 7 })).toEqual(chain);
  });

  it('prices calls lower and puts higher as the strike rises', () => {
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].call.theo).toBeLessThan(chain[i - 1].call.theo);
      expect(chain[i].put.theo).toBeGreaterThan(chain[i - 1].put.theo);
    }
  });

  it('marks calls below the spot and puts above it as in the money', () => {
    const row = (k: number) => chain.find((r) => r.strike === k)!;
    expect(row(90).call.inTheMoney).toBe(true);
    expect(row(110).call.inTheMoney).toBe(false);
    expect(row(110).put.inTheMoney).toBe(true);
    expect(row(90).put.inTheMoney).toBe(false);
  });

  it('has more open interest near the money than far from it', () => {
    const oi = (k: number) => chain.find((r) => r.strike === k)!.call.openInterest;
    expect(oi(100)).toBeGreaterThan(oi(80));
    expect(oi(100)).toBeGreaterThan(oi(120));
  });

  it('keeps daily volume below open interest (a modelling choice, not a market rule)', () => {
    for (const r of chain) expect(r.call.volume).toBeLessThan(r.call.openInterest + 1);
  });
});
