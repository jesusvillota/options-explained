import { normalRng } from '../math/rng';
import { greeks, price, type BSInput } from './blackScholes';
import type { OptionType } from './payoff';
import { payoff } from './payoff';

/**
 * Delta hedging in discrete time (Chapters 22 and 24). An option is sold at the
 * Black–Scholes price with the implied volatility, and the seller holds Δ shares,
 * rebalancing `steps` times until expiry, while the stock actually follows GBM
 * with the realised volatility. Money accrues at r.
 */
export interface HedgeInput {
  type: OptionType;
  S0: number;
  K: number;
  T: number;
  r: number;
  /** Volatility used to price and hedge. */
  impliedVol: number;
  /** Volatility the stock actually has. */
  realisedVol: number;
  /** Real-world drift of the stock. */
  mu: number;
  steps: number;
  paths: number;
  seed: number;
}

export interface HedgeResult {
  /** Final P&L of each path (seller's view, in today's money at expiry). */
  pnl: number[];
  /** For the first path: time grid, stock and running P&L marked to Black–Scholes. */
  sample: { t: number[]; S: number[]; pnl: number[] };
  premium: number;
}

export function simulateHedge(h: HedgeInput): HedgeResult {
  const { type, S0, K, T, r, impliedVol, realisedVol, mu, steps, paths, seed } = h;
  const dt = T / steps;
  const z = normalRng(seed);
  const bs = (S: number, tau: number): BSInput => ({ S, K, T: tau, r, sigma: impliedVol });
  const premium = price(type, bs(S0, T));
  const pnl: number[] = [];
  const sample = { t: [0] as number[], S: [S0] as number[], pnl: [0] as number[] };
  for (let p = 0; p < paths; p++) {
    let S = S0;
    let delta = greeks(type, bs(S, T)).delta;
    let cash = premium - delta * S; // sold the option, bought Δ shares
    for (let i = 1; i <= steps; i++) {
      S *= Math.exp((mu - 0.5 * realisedVol * realisedVol) * dt + realisedVol * Math.sqrt(dt) * z());
      cash *= Math.exp(r * dt);
      const tau = T - i * dt;
      if (i < steps) {
        const next = greeks(type, bs(S, tau)).delta;
        cash -= (next - delta) * S;
        delta = next;
        if (p === 0) {
          sample.t.push(i * dt);
          sample.S.push(S);
          sample.pnl.push(cash + delta * S - price(type, bs(S, tau)));
        }
      }
    }
    const final = cash + delta * S - payoff(type, S, K);
    pnl.push(final);
    if (p === 0) {
      sample.t.push(T);
      sample.S.push(S);
      sample.pnl.push(final);
    }
  }
  return { pnl, sample, premium };
}

/**
 * One period of a delta-hedged long option: the gamma gain ½ΓS²(ΔS/S)² and the
 * time cost (Chapter 22). The cost is theta *net of financing* the hedge,
 * Θ + (r − q)SΔ − rV = −½σ²S²Γ by the Black–Scholes PDE, so the position breaks
 * even exactly at a move of σ√dt. Net = ½ΓS²[(ΔS/S)² − σ²dt].
 */
export function thetaGammaSplit(type: OptionType, input: BSInput, relativeMove: number, dt: number) {
  const g = greeks(type, input);
  const dollarGamma = 0.5 * g.gamma * input.S * input.S;
  const gammaGain = dollarGamma * relativeMove * relativeMove;
  const thetaCost = -dollarGamma * input.sigma * input.sigma * dt;
  return { gammaGain, thetaCost, net: gammaGain + thetaCost, breakevenMove: input.sigma * Math.sqrt(dt) };
}
