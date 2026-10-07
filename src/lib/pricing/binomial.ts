import type { OptionType } from './payoff';
import { payoff } from './payoff';
import type { BSInput } from './blackScholes';

export interface BinomialInput extends BSInput {
  steps: number;
  american?: boolean;
}

/** Cox–Ross–Rubinstein parameters for one step of length Δt = T / steps. */
export function crrParameters({ T, r, sigma, q = 0, steps }: BinomialInput) {
  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const growth = Math.exp((r - q) * dt);
  const p = (growth - d) / (u - d);
  return { dt, u, d, p, discount: Math.exp(-r * dt) };
}

/** Price a European or American option on a CRR binomial tree by backward induction. */
export function binomialPrice(type: OptionType, input: BinomialInput): number {
  const { S, K, steps, american = false } = input;
  const { u, d, p, discount } = crrParameters(input);
  if (p <= 0 || p >= 1) throw new Error('binomial: no-arbitrage condition d < e^{(r−q)Δt} < u violated');
  const values: number[] = [];
  for (let j = 0; j <= steps; j++) values.push(payoff(type, S * u ** j * d ** (steps - j), K));
  for (let i = steps - 1; i >= 0; i--) {
    for (let j = 0; j <= i; j++) {
      const cont = discount * (p * values[j + 1] + (1 - p) * values[j]);
      values[j] = american ? Math.max(cont, payoff(type, S * u ** j * d ** (i - j), K)) : cont;
    }
  }
  return values[0];
}
