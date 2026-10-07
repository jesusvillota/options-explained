import { describe, expect, it } from 'vitest';
import { lognormalCdf, lognormalMean, lognormalMedian, lognormalPdf } from '../src/lib/math/lognormal';
import { binomialPrice, binomialTree, terminalDistribution } from '../src/lib/pricing/binomial';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import { replicate, riskNeutralPrice } from '../src/lib/pricing/oneStep';

describe('one-period replication', () => {
  // Classic textbook example: S0 = 100, up to 120 or down to 80, call K = 100, r = 0.
  const input = { S0: 100, Su: 120, Sd: 80, Vu: 20, Vd: 0, r: 0, T: 1 };

  it('replicates a call with half a share and a loan', () => {
    const rep = replicate(input);
    expect(rep.delta).toBeCloseTo(0.5, 12);
    expect(rep.bond).toBeCloseTo(-40, 12);
    expect(rep.price).toBeCloseTo(10, 12);
    expect(rep.q).toBeCloseTo(0.5, 12);
  });

  it('agrees with the risk-neutral expectation, with interest too', () => {
    const withRate = { ...input, r: 0.05 };
    expect(riskNeutralPrice(withRate)).toBeCloseTo(replicate(withRate).price, 12);
    // Replicating portfolio pays Vu and Vd.
    const rep = replicate(withRate);
    expect(rep.delta * 120 + rep.bond * Math.exp(0.05)).toBeCloseTo(20, 12);
    expect(rep.delta * 80 + rep.bond * Math.exp(0.05)).toBeCloseTo(0, 12);
  });

  it('flags the no-arbitrage condition', () => {
    expect(replicate({ ...input, Su: 120, Sd: 101 }).arbitrageFree).toBe(false);
    expect(replicate(input).arbitrageFree).toBe(true);
  });
});

describe('trees', () => {
  it('fill every node, and the root equals binomialPrice', () => {
    const input = { ...DEFAULTS, steps: 6, american: true };
    const tree = binomialTree('put', input);
    expect(tree).toHaveLength(7);
    expect(tree[0][0].value).toBeCloseTo(binomialPrice('put', input), 12);
    expect(tree.flat().some((n) => n.exercise)).toBe(true);
    expect(binomialTree('call', { ...input, american: false }).flat().some((n) => n.exercise)).toBe(false);
  });

  it('have terminal probabilities that sum to 1 and a forward-price mean', () => {
    const dist = terminalDistribution({ ...DEFAULTS, steps: 400 });
    expect(dist.reduce((s, x) => s + x.prob, 0)).toBeCloseTo(1, 10);
    const mean = dist.reduce((s, x) => s + x.S * x.prob, 0);
    expect(mean).toBeCloseTo(100 * Math.exp(0.05), 8);
  });

  it('converge to Black–Scholes, with error shrinking roughly like 1/n', () => {
    const bs = price('call', DEFAULTS);
    const e50 = Math.abs(binomialPrice('call', { ...DEFAULTS, steps: 50 }) - bs);
    const e800 = Math.abs(binomialPrice('call', { ...DEFAULTS, steps: 800 }) - bs);
    expect(e800).toBeLessThan(e50 / 5);
  });
});

describe('lognormal', () => {
  const p = { S0: 100, mu: 0.05, sigma: 0.2, T: 1 };
  it('integrates to the cdf and has the right mean and median', () => {
    let area = 0;
    for (let x = 0.5; x < 400; x += 0.5) area += 0.5 * lognormalPdf(x, p);
    expect(area).toBeCloseTo(1, 3);
    expect(lognormalCdf(lognormalMedian(p), p)).toBeCloseTo(0.5, 12);
    expect(lognormalMean(p)).toBeCloseTo(105.127, 3);
  });
});
