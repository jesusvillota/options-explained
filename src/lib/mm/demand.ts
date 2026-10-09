import { greeks, price } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';
import { impliedVol } from '../vol/impliedVol';

/**
 * Demand-based option pricing (Chapter 60), after Gârleanu, Pedersen and
 * Poteshman (2009). Dealers absorb end users' net demand d and delta-hedge, but
 * can't hedge everything: volatility moves and crashes leave unhedgeable P&L ε.
 * A dealer with risk aversion γ then charges p = p_BS + γ Σ d, with Σ the
 * covariance of the unhedgeable P&L across options.
 */

export const DEMAND_MARKET = { S: 100, T: 0.25, r: 0.05, sigma: 0.2 };
export const DEMAND_STRIKES = [85, 90, 95, 100, 105, 110, 115];

export interface UnhedgeableRisk {
  /** Volatility uncertainty over the hedging horizon, in vol points (standard deviation). */
  volOfVol: number;
  /** Probability of a crash over the horizon, and its size (fraction of the stock price). */
  crashProb: number;
  crashSize: number;
}

export const DEFAULT_RISK: UnhedgeableRisk = { volOfVol: 1.5, crashProb: 0.05, crashSize: 0.15 };

export const typeAt = (K: number): OptionType => (K < DEMAND_MARKET.S ? 'put' : 'call');

/**
 * Per-share exposures of each option (out of the money: puts below 100, calls
 * from 100) to the two unhedgeable risks: vega per vol point, and the
 * delta-hedged P&L of holding the option through a crash.
 */
export function exposures(strikes: number[] = DEMAND_STRIKES, risk: UnhedgeableRisk = DEFAULT_RISK): { vega: number[]; crash: number[] } {
  const m = DEMAND_MARKET;
  const vega: number[] = [], crash: number[] = [];
  for (const K of strikes) {
    const type = typeAt(K);
    const input = { ...m, K };
    const g = greeks(type, input);
    vega.push(g.vega * 0.01);
    const after = price(type, { ...input, S: m.S * (1 - risk.crashSize) });
    crash.push(after - price(type, input) + g.delta * m.S * risk.crashSize);
  }
  return { vega, crash };
}

/** Covariance (per share², per contract of 100 shares) of the options' unhedgeable P&L. */
export function unhedgeableCovariance(strikes: number[] = DEMAND_STRIKES, risk: UnhedgeableRisk = DEFAULT_RISK): number[][] {
  const { vega, crash } = exposures(strikes, risk);
  const p = risk.crashProb, crashVar = p * (1 - p);
  return strikes.map((_, i) => strikes.map((__, j) => risk.volOfVol ** 2 * vega[i] * vega[j] + crashVar * crash[i] * crash[j]));
}

/**
 * Price premium per share from net end-user demand d (contracts; positive =
 * end users buy): Δp = γ Σ d, with Σ per share² and d scaled to shares.
 */
export function demandPremium(demand: number[], gamma: number, strikes: number[] = DEMAND_STRIKES, risk: UnhedgeableRisk = DEFAULT_RISK): number[] {
  const S = unhedgeableCovariance(strikes, risk);
  return S.map((row) => gamma * row.reduce((a, s, j) => a + s * demand[j] * 100, 0));
}

/** Implied volatilities with and without the demand premium. */
export function demandSmile(demand: number[], gamma: number, risk: UnhedgeableRisk = DEFAULT_RISK): { strike: number; base: number; withDemand: number; premium: number }[] {
  const m = DEMAND_MARKET;
  const prem = demandPremium(demand, gamma, DEMAND_STRIKES, risk);
  return DEMAND_STRIKES.map((K, i) => {
    const type = typeAt(K);
    const p0 = price(type, { ...m, K });
    const p1 = Math.max(p0 + prem[i], 1e-6);
    return { strike: K, base: m.sigma, withDemand: impliedVol(type, p1, { S: m.S, K, T: m.T, r: m.r }).sigma, premium: prem[i] };
  });
}

export const DEMAND_PRESETS: Record<string, { label: string; demand: number[] }> = {
  index: { label: 'Index: buy puts, sell calls', demand: [800, 1100, 900, 0, -300, -400, -300] },
  insurance: { label: 'Portfolio insurance: buy puts', demand: [800, 1100, 900, 0, 0, 0, 0] },
  overwriting: { label: 'Single stock: sell calls', demand: [0, 0, 0, -200, -500, -500, -300] },
  straddles: { label: 'Buy at-the-money volatility', demand: [0, 0, 400, 1200, 400, 0, 0] },
  none: { label: 'No net demand', demand: [0, 0, 0, 0, 0, 0, 0] },
};
