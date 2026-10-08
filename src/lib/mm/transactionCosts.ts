import { normalRng } from '../math/rng';
import { greeks, price } from '../pricing/blackScholes';
import { payoff } from '../pricing/payoff';

/**
 * Hedging with transaction costs (Chapter 59). Every share bought or sold costs
 * a fraction ε of its value. Hedging more often reduces the hedging error but
 * raises the cost; Leland adjusts the volatility to pay for it, and Whalley and
 * Wilmott trade only when the hedge drifts out of a band.
 */

/** Leland's number Le = √(2/π) · k/(σ√δt), with k = 2ε the round-trip cost. */
export function lelandNumber(sigma: number, eps: number, dt: number): number {
  return Math.sqrt(2 / Math.PI) * (2 * eps) / (sigma * Math.sqrt(dt));
}

/** Leland's adjusted volatility: σ² (1 + Le) for a short option (the hedger buys high, sells low), σ² (1 − Le) for a long one. */
export function lelandVol(sigma: number, eps: number, dt: number, short = true): number {
  const le = lelandNumber(sigma, eps, dt);
  return sigma * Math.sqrt(Math.max(1 + (short ? le : -le), 0));
}

/** Whalley–Wilmott half-width of the no-trade band around the Black–Scholes delta. */
export function wwBand(gammaBS: number, S: number, eps: number, riskAversion: number, r: number, tau: number): number {
  return Math.cbrt((1.5 * Math.exp(-r * tau) * eps * S * gammaBS * gammaBS) / riskAversion);
}

export interface CostHedgeInput {
  S0: number;
  K: number;
  T: number;
  r: number;
  sigma: number;
  /** One-way proportional cost ε. */
  eps: number;
  paths: number;
  seed: number;
  /** 'time': rebalance to delta every step. 'band': check every step, trade only to the edge of the band. */
  mode: 'time' | 'band';
  steps: number;
  /** Risk aversion for the band. */
  riskAversion?: number;
  /** Volatility used for the hedge ratio (Leland's, for instance). Defaults to σ. */
  hedgeVol?: number;
}

export interface CostHedgeResult {
  /** Mean of the hedger's final P&L before costs (selling at the Black–Scholes price). */
  meanError: number;
  /** Standard deviation of the final P&L (including costs). */
  sdPnl: number;
  /** Mean transaction cost paid. */
  meanCost: number;
  /** Mean number of trades in the stock. */
  meanTrades: number;
}

/**
 * Sell a call at its Black–Scholes price and hedge it: realised volatility = σ,
 * zero drift relative to r (so P&L is about hedging, not direction).
 */
export function simulateCostHedge(h: CostHedgeInput): CostHedgeResult {
  const z = normalRng(h.seed);
  const dt = h.T / h.steps;
  const hv = h.hedgeVol ?? h.sigma;
  const premium = price('call', { S: h.S0, K: h.K, T: h.T, r: h.r, sigma: h.sigma });
  let sumPnl = 0, sumPnl2 = 0, sumCost = 0, sumTrades = 0, sumErr = 0;
  for (let p = 0; p < h.paths; p++) {
    let S = h.S0, cost = 0, trades = 0;
    let held = greeks('call', { S, K: h.K, T: h.T, r: h.r, sigma: hv }).delta;
    if (h.mode === 'band') {
      const g = greeks('call', { S, K: h.K, T: h.T, r: h.r, sigma: h.sigma }).gamma;
      const H = wwBand(g, S, h.eps, h.riskAversion ?? 1, h.r, h.T);
      held = Math.max(held - H, 0); // start at the near edge of the band
    }
    cost += h.eps * held * S;
    trades++;
    let cash = premium - held * S - h.eps * held * S;
    for (let i = 1; i <= h.steps; i++) {
      S *= Math.exp((h.r - 0.5 * h.sigma * h.sigma) * dt + h.sigma * Math.sqrt(dt) * z());
      cash *= Math.exp(h.r * dt);
      const tau = h.T - i * dt;
      if (i === h.steps) break;
      const g = greeks('call', { S, K: h.K, T: tau, r: h.r, sigma: hv });
      let target = g.delta;
      if (h.mode === 'band') {
        const H = wwBand(greeks('call', { S, K: h.K, T: tau, r: h.r, sigma: h.sigma }).gamma, S, h.eps, h.riskAversion ?? 1, h.r, tau);
        if (Math.abs(held - g.delta) <= H) continue;
        target = held > g.delta ? g.delta + H : g.delta - H;
      }
      const trade = target - held;
      if (trade === 0) continue;
      const c = h.eps * Math.abs(trade) * S;
      cash -= trade * S + c;
      cost += c;
      trades++;
      held = target;
    }
    const pnl = cash + held * S - payoff('call', S, h.K);
    sumPnl += pnl;
    sumPnl2 += pnl * pnl;
    sumErr += pnl + cost;
    sumCost += cost;
    sumTrades += trades;
  }
  const n = h.paths, mean = sumPnl / n;
  return { meanError: sumErr / n, sdPnl: Math.sqrt(Math.max(sumPnl2 / n - mean * mean, 0)), meanCost: sumCost / n, meanTrades: sumTrades / n };
}
