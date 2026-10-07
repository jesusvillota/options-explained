import { greeks, price, secondOrderGreeks } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';

/** One line of an options book: quantity (negative = short) of a European option. */
export interface Position {
  type: OptionType;
  K: number;
  T: number;
  quantity: number;
}

export interface MarketState {
  S: number;
  sigma: number;
  r: number;
}

export interface PnLExplain {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  vanna: number;
  unexplained: number;
  actual: number;
}

/**
 * Attribute a book's P&L over one day to the Greeks (Chapter 42): a Taylor
 * expansion of the value in the stock move dS, the volatility move dσ and the
 * passage of time dt, measured against a full revaluation.
 */
export function explainPnL(book: Position[], before: MarketState, after: MarketState, dt: number): PnLExplain {
  const dS = after.S - before.S, dSigma = after.sigma - before.sigma;
  const out: PnLExplain = { delta: 0, gamma: 0, vega: 0, theta: 0, vanna: 0, unexplained: 0, actual: 0 };
  for (const p of book) {
    const in0 = { S: before.S, K: p.K, T: p.T, r: before.r, sigma: before.sigma };
    const in1 = { S: after.S, K: p.K, T: Math.max(p.T - dt, 1e-9), r: after.r, sigma: after.sigma };
    const g = greeks(p.type, in0);
    const g2 = secondOrderGreeks(p.type, in0);
    out.delta += p.quantity * g.delta * dS;
    out.gamma += p.quantity * 0.5 * g.gamma * dS * dS;
    out.vega += p.quantity * g.vega * dSigma;
    out.theta += p.quantity * g.theta * dt;
    out.vanna += p.quantity * g2.vanna * dS * dSigma;
    out.actual += p.quantity * (price(p.type, in1) - price(p.type, in0));
  }
  out.unexplained = out.actual - (out.delta + out.gamma + out.vega + out.theta + out.vanna);
  return out;
}
