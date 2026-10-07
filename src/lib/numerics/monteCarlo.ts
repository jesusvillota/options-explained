import { normalRng } from '../math/rng';
import type { BSInput } from '../pricing/blackScholes';
import { payoff, type OptionType } from '../pricing/payoff';

/** Variance-reduction technique for a Monte Carlo price (Chapter 33). */
export type Technique = 'plain' | 'antithetic' | 'control';

export interface MCResult {
  /** Number of payoff evaluations at each checkpoint. */
  n: number[];
  /** Running estimate at each checkpoint. */
  estimate: number[];
  /** Its standard error (one standard deviation of the estimator). */
  stdError: number[];
}

/**
 * Monte Carlo price of a European option under GBM, with running estimates at
 * checkpoints so convergence can be plotted.
 *
 * - plain: average of e^{−rT}payoff(S_T) over independent draws.
 * - antithetic: each draw Z is paired with −Z and the two payoffs averaged;
 *   the pair counts as two evaluations.
 * - control: Y − b(S_T − F) with F = E[S_T] known exactly, and the optimal b
 *   estimated from the samples so far.
 */
export function mcEuropean(type: OptionType, { S, K, T, r, sigma, q = 0 }: BSInput, total: number, seed: number, technique: Technique = 'plain', checkpoints = 40): MCResult {
  const z = normalRng(seed);
  const drift = (r - q - 0.5 * sigma * sigma) * T, vol = sigma * Math.sqrt(T), disc = Math.exp(-r * T);
  const F = S * Math.exp((r - q) * T);
  const terminal = (x: number) => S * Math.exp(drift + vol * x);
  // Log-spaced checkpoints from 16 to `total` evaluations.
  const marks = [...new Set(Array.from({ length: checkpoints }, (_, k) => Math.round(Math.exp(Math.log(16) + ((Math.log(total) - Math.log(16)) * k) / (checkpoints - 1)))))];
  const out: MCResult = { n: [], estimate: [], stdError: [] };
  // Running sums for Y, Y², X, X², XY (X = control variate S_T − F, mean zero).
  let sy = 0, syy = 0, sx = 0, sxx = 0, sxy = 0, m = 0, next = 0;
  const step = technique === 'antithetic' ? 2 : 1;
  for (let evals = step; evals <= total && next < marks.length; evals += step) {
    const x = z();
    let y: number, ctl = 0;
    if (technique === 'antithetic') {
      y = 0.5 * disc * (payoff(type, terminal(x), K) + payoff(type, terminal(-x), K));
    } else {
      const ST = terminal(x);
      y = disc * payoff(type, ST, K);
      ctl = ST - F;
    }
    m++;
    sy += y; syy += y * y; sx += ctl; sxx += ctl * ctl; sxy += ctl * y;
    if (evals < marks[next]) continue;
    while (next < marks.length && marks[next] <= evals) next++;
    const my = sy / m, vy = Math.max(syy / m - my * my, 0);
    let est = my, variance = vy;
    if (technique === 'control' && m > 2) {
      const mx = sx / m, vx = sxx / m - mx * mx, cxy = sxy / m - mx * my;
      const b = vx > 0 ? cxy / vx : 0;
      est = my - b * mx;
      variance = Math.max(vy - (vx > 0 ? (cxy * cxy) / vx : 0), 0);
    }
    out.n.push(evals); out.estimate.push(est); out.stdError.push(Math.sqrt(variance / m));
  }
  return out;
}
