import { mulberry32 } from '../math/rng';

/**
 * Speed, ticks and market design (Chapter 73), after Budish, Cramton and Shim
 * (2015). Public news moves an asset's value by ±J. A liquidity provider
 * quoting around the old value races to cancel; N fast traders race to trade
 * against the stale quote. Reaction times are a common base latency plus
 * independent exponential jitter with mean j (microseconds); the provider may
 * be faster or slower than the snipers by an edge (positive = provider faster).
 */

export interface RaceParams {
  snipers: number;
  /** Provider's speed advantage, microseconds (negative = slower). */
  edge: number;
  /** Mean of the exponential jitter in reaction times, microseconds. */
  jitter: number;
  /** Common base latency, microseconds (only shifts the picture). */
  base?: number;
}

/** One race: arrival times after the news, in microseconds. */
export function raceOnce(p: RaceParams, seed: number): { provider: number; snipers: number[]; providerWins: boolean } {
  const u = mulberry32(seed), base = p.base ?? 20;
  const exp = () => -p.jitter * Math.log(1 - u());
  const provider = base - p.edge + exp();
  const snipers = Array.from({ length: p.snipers }, () => base + exp());
  return { provider, snipers, providerWins: provider < Math.min(...snipers) };
}

/**
 * Probability the provider's cancel arrives first. With E₀ ~ Exp(1/j) for the
 * provider and M = min of N snipers' jitters ~ Exp(N/j):
 *   edge ≥ 0: 1 − (N/(N+1)) e^{−edge/j};  edge < 0: (1/(N+1)) e^{N·edge/j}.
 * With no edge, it's 1/(N + 1): one racer among N + 1.
 */
export function providerWinProb(p: RaceParams): number {
  const N = p.snipers, j = p.jitter;
  if (N === 0) return 1;
  return p.edge >= 0 ? 1 - (N / (N + 1)) * Math.exp(-p.edge / j) : (1 / (N + 1)) * Math.exp((N * p.edge) / j);
}

/** Expected head start of the fastest sniper over the provider, E[(T_provider − T_sniper)⁺], microseconds. */
export function expectedLead(p: RaceParams): number {
  const N = p.snipers, j = p.jitter;
  if (N === 0) return 0;
  const a = 1 / j, b = N / j, e = p.edge;
  // D = T_provider − min T_sniper = −edge + E₀ − M; E[D⁺] = ∫₀^∞ P(D > x) dx.
  if (e >= 0) return ((b / (a + b)) * Math.exp(-a * e)) / a;
  const d = -e;
  return d - (a / (a + b)) * (1 - Math.exp(-b * d)) / b + (b / (a + b)) / a;
}

/**
 * Chance that a news event gets sniped. Continuous market: whenever a sniper
 * arrives first. Frequent batch auction with interval τ (microseconds): only if
 * the batch closes after the sniper's order but before the provider's cancel,
 * which happens with probability about E[(T_provider − T_sniper)⁺]/τ.
 */
export function snipeProb(p: RaceParams, batchInterval = 0): number {
  const continuous = 1 - providerWinProb(p);
  if (batchInterval <= 0) return continuous;
  return Math.min(continuous, expectedLead(p) / batchInterval);
}

export interface FlowParams {
  /** News jumps per minute, and their size (cents). */
  jumpRate: number;
  jump: number;
  /** Ordinary investor orders per minute. */
  investorRate: number;
}

export const DEFAULT_FLOW: FlowParams = { jumpRate: 1, jump: 10, investorRate: 2 };

/**
 * Zero-profit half-spread: investors pay h each; sniped quotes lose J − h.
 *   λ_I h = λ_J π (J − h)   ⇒   h = λ_J π J / (λ_I + λ_J π),
 * with π the probability that a news event gets sniped.
 */
export function equilibriumHalfSpread(pi: number, f: FlowParams = DEFAULT_FLOW): number {
  return (f.jumpRate * pi * f.jump) / (f.investorRate + f.jumpRate * pi);
}

/** Monte Carlo check of the provider's chance of winning the race. */
export function simulateWinShare(p: RaceParams, n: number, seed: number): number {
  let w = 0;
  for (let i = 0; i < n; i++) if (raceOnce(p, seed + i * 7919).providerWins) w++;
  return w / n;
}
