import { mulberry32 } from '../math/rng';
import { nelderMead } from '../math/optimize';

/**
 * The probability of informed trading (Easley, Kiefer, O'Hara and Paperman, 1996),
 * Chapter 53.
 *
 * Each day, with probability α there's private news: bad with probability δ,
 * good otherwise. Uninformed buys and sells arrive as Poisson processes with
 * rate ε each; on news days informed traders add Poisson orders at rate μ on the
 * side of the news. PIN = αμ / (αμ + 2ε) is the share of orders that come from
 * informed traders.
 */

export interface PinParams {
  alpha: number;
  delta: number;
  mu: number;
  eps: number;
}

export function pin({ alpha, mu, eps }: PinParams): number {
  return (alpha * mu) / (alpha * mu + 2 * eps);
}

const LOG_FACTORIAL: number[] = [0];
function logFactorial(k: number): number {
  for (let i = LOG_FACTORIAL.length; i <= k; i++) LOG_FACTORIAL.push(LOG_FACTORIAL[i - 1] + Math.log(i));
  return LOG_FACTORIAL[k];
}

/** ln of the Poisson probability of k events at rate λ. */
function logPoisson(k: number, lambda: number): number {
  return -lambda + k * Math.log(lambda) - logFactorial(k);
}

/** Log-likelihood of one day with B buys and S sells: a mixture over no news, bad news and good news. */
export function dayLogLikelihood(B: number, S: number, p: PinParams): number {
  const { alpha, delta, mu, eps } = p;
  const terms = [
    Math.log(1 - alpha) + logPoisson(B, eps) + logPoisson(S, eps),
    Math.log(alpha * delta) + logPoisson(B, eps) + logPoisson(S, eps + mu),
    Math.log(alpha * (1 - delta)) + logPoisson(B, eps + mu) + logPoisson(S, eps),
  ];
  const m = Math.max(...terms);
  return m + Math.log(terms.reduce((a, t) => a + Math.exp(t - m), 0));
}

export interface PinDay {
  buys: number;
  sells: number;
  /** 'none', 'bad' or 'good'. */
  news: 'none' | 'bad' | 'good';
}

function poisson(rng: () => number, lambda: number): number {
  // Knuth's method for small rates; a normal approximation for large ones.
  if (lambda > 60) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
  }
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

export function simulatePinDays(p: PinParams, days: number, seed: number): PinDay[] {
  const rng = mulberry32(seed);
  return Array.from({ length: days }, () => {
    const news = rng() < p.alpha ? (rng() < p.delta ? 'bad' : 'good') : 'none';
    const buys = poisson(rng, p.eps + (news === 'good' ? p.mu : 0));
    const sells = poisson(rng, p.eps + (news === 'bad' ? p.mu : 0));
    return { buys, sells, news };
  });
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));

/** Maximum-likelihood estimate of the PIN parameters, by Nelder–Mead on transformed parameters. */
export function fitPin(days: PinDay[]): PinParams & { pin: number; logLik: number } {
  const meanB = days.reduce((a, d) => a + d.buys, 0) / days.length;
  const meanS = days.reduce((a, d) => a + d.sells, 0) / days.length;
  const decode = (x: number[]): PinParams => ({ alpha: logistic(x[0]), delta: logistic(x[1]), mu: Math.exp(x[2]), eps: Math.exp(x[3]) });
  const negLL = (x: number[]) => {
    const p = decode(x);
    return -days.reduce((a, d) => a + dayLogLikelihood(d.buys, d.sells, p), 0);
  };
  // Start from a few guesses and keep the best: mixture likelihoods have local maxima.
  const eps0 = Math.min(meanB, meanS);
  const starts = [0.2, 0.4, 0.6].map((a) => [logit(a), 0, Math.log(Math.max(Math.abs(meanB - meanS) / a + 1, 1)), Math.log(Math.max(eps0, 1))]);
  let best = { x: starts[0], fx: Infinity };
  for (const s of starts) {
    const r = nelderMead(negLL, s, { step: 0.5, tol: 1e-10, maxIter: 3000 });
    if (r.fx < best.fx) best = r;
  }
  const p = decode(best.x);
  return { ...p, pin: pin(p), logLik: -best.fx };
}
