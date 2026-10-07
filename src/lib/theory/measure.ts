import { normalRng } from '../math/rng';

/**
 * Changes of measure for GBM (Chapter 40). Under the real-world measure P the
 * stock drifts at μ; under the risk-neutral measure Q at r. Girsanov: with the
 * market price of risk θ = (μ − r)/σ, the density process
 *   Z_T = dQ/dP = exp(−θW_T − ½θ²T)
 * turns P-expectations into Q-expectations: E^Q[X] = E^P[Z_T X].
 */
export interface MeasureInput {
  S: number;
  mu: number;
  r: number;
  sigma: number;
  T: number;
}

export const marketPriceOfRisk = ({ mu, r, sigma }: MeasureInput) => (mu - r) / sigma;

/** Radon–Nikodym weight dQ/dP for a path whose Brownian motion ends at W_T (under P). */
export function girsanovWeight(WT: number, theta: number, T: number): number {
  return Math.exp(-theta * WT - 0.5 * theta * theta * T);
}

export interface WeightedSample {
  /** Terminal stock price, simulated under P. */
  ST: number;
  /** Its weight dQ/dP. */
  weight: number;
}

/** Terminal prices simulated under P, each with its Girsanov weight. */
export function realWorldSamples(input: MeasureInput, n: number, seed: number): WeightedSample[] {
  const { S, mu, sigma, T } = input;
  const theta = marketPriceOfRisk(input);
  const z = normalRng(seed);
  return Array.from({ length: n }, () => {
    const WT = Math.sqrt(T) * z();
    return { ST: S * Math.exp((mu - 0.5 * sigma * sigma) * T + sigma * WT), weight: girsanovWeight(WT, theta, T) };
  });
}

/**
 * Price a payoff from real-world samples: e^{−rT}·(1/n)Σ Z_i·payoff(S_T,i).
 * Without the weights (Z = 1) the average is the real-world expectation,
 * which is the wrong price whenever μ ≠ r.
 */
export function priceFromRealWorld(samples: WeightedSample[], payoff: (ST: number) => number, r: number, T: number, weighted = true): number {
  const total = samples.reduce((a, s) => a + (weighted ? s.weight : 1) * payoff(s.ST), 0);
  return (Math.exp(-r * T) * total) / samples.length;
}

/**
 * The drift of the stock under three measures (Chapter 40): real-world μ,
 * risk-neutral r (numeraire: the bank account), and r + σ² under the share
 * measure (numeraire: the stock itself), where N(d₁) is the probability of
 * finishing in the money.
 */
export const driftUnder = (measure: 'P' | 'Q' | 'share', { mu, r, sigma }: MeasureInput) =>
  measure === 'P' ? mu : measure === 'Q' ? r : r + sigma * sigma;
