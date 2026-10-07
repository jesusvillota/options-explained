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

export interface BoundaryPoint {
  /** Time from today, in years. */
  t: number;
  /** Critical stock price: exercise at or below it (put) or at or above it (call). Null if never optimal. */
  S: number | null;
}

/**
 * The early-exercise boundary of an American option. For each of `points`
 * times between today and expiry, bisect on the stock price for where the
 * tree's American value first equals the payoff (exercise is optimal there).
 */
export function exerciseBoundary(type: OptionType, input: BinomialInput, points = 24): BoundaryPoint[] {
  const { K, T } = input;
  const out: BoundaryPoint[] = [];
  for (let k = 0; k <= points; k++) {
    const t = (T * k) / points;
    const tau = T - t;
    if (tau <= 1e-9) {
      out.push({ t, S: K });
      continue;
    }
    const steps = Math.max(40, Math.round(input.steps * (tau / T)));
    const exercised = (S: number) => {
      const ex = payoff(type, S, K);
      if (ex <= 0) return false;
      const am = binomialPrice(type, { ...input, S, T: tau, steps, american: true });
      return am - ex < 1e-9 * K;
    };
    // Put: exercise for S ≤ S*. Call (with dividends): exercise for S ≥ S*.
    let lo = type === 'put' ? K * 1e-3 : K;
    let hi = type === 'put' ? K : K * 20;
    if (!exercised(type === 'put' ? lo : hi)) {
      out.push({ t, S: null });
      continue;
    }
    for (let i = 0; i < 40; i++) {
      const mid = 0.5 * (lo + hi);
      if (exercised(mid) === (type === 'put')) lo = mid;
      else hi = mid;
    }
    out.push({ t, S: 0.5 * (lo + hi) });
  }
  return out;
}

export interface TreeNode {
  /** Time step (0 = today). */
  i: number;
  /** Number of up moves. */
  j: number;
  S: number;
  value: number;
  /** American only: exercising here is optimal (and strictly in the money). */
  exercise: boolean;
}

/**
 * Every node of a small CRR tree, values filled in by backward induction
 * (Chapter 13). Returns columns from today (index 0) to expiry.
 */
export function binomialTree(type: OptionType, input: BinomialInput): TreeNode[][] {
  const { S, K, steps, american = false } = input;
  const { u, d, p, discount } = crrParameters(input);
  const cols: TreeNode[][] = [];
  const last: TreeNode[] = [];
  for (let j = 0; j <= steps; j++) {
    const s = S * u ** j * d ** (steps - j);
    last.push({ i: steps, j, S: s, value: payoff(type, s, K), exercise: false });
  }
  cols[steps] = last;
  for (let i = steps - 1; i >= 0; i--) {
    const col: TreeNode[] = [];
    for (let j = 0; j <= i; j++) {
      const s = S * u ** j * d ** (i - j);
      const cont = discount * (p * cols[i + 1][j + 1].value + (1 - p) * cols[i + 1][j].value);
      const ex = payoff(type, s, K);
      const exercise = american && ex > cont + 1e-12;
      col.push({ i, j, S: s, value: exercise ? ex : cont, exercise });
    }
    cols[i] = col;
  }
  return cols;
}

/** Terminal stock prices of an n-step CRR tree and their risk-neutral probabilities. */
export function terminalDistribution(input: BinomialInput): { S: number; prob: number }[] {
  const { S, steps } = input;
  const { u, d, p } = crrParameters(input);
  const out: { S: number; prob: number }[] = [];
  // log of binomial coefficient, computed incrementally to stay accurate for large n
  let logC = 0;
  for (let j = 0; j <= steps; j++) {
    if (j > 0) logC += Math.log((steps - j + 1) / j);
    out.push({ S: S * u ** j * d ** (steps - j), prob: Math.exp(logC + j * Math.log(p) + (steps - j) * Math.log(1 - p)) });
  }
  return out;
}
