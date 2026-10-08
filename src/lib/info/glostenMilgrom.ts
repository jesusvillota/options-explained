import { mulberry32 } from '../math/rng';

/**
 * The Glosten–Milgrom (1985) sequential-trade model (Chapter 50).
 *
 * The asset is worth v_H or v_L. Each period one trader arrives: with
 * probability α an insider, who buys if the value is high and sells if it's low;
 * otherwise an uninformed trader, who buys or sells with probability ½ each.
 * A competitive, risk-neutral market maker with belief p = P(v = v_H) sets
 *   ask = E[v | buy],   bid = E[v | sell],
 * and updates its belief by Bayes' rule after each trade.
 */

export interface GMParams {
  alpha: number;
  vL: number;
  vH: number;
}

/** P(buy | v_H), P(buy | v_L). */
export function buyProbabilities(alpha: number): { high: number; low: number } {
  return { high: alpha + (1 - alpha) / 2, low: (1 - alpha) / 2 };
}

/** Belief after observing a buy (+1) or a sell (−1). */
export function updateBelief(p: number, alpha: number, side: 1 | -1): number {
  const { high, low } = buyProbabilities(alpha);
  const lh = side === 1 ? high : 1 - high;
  const ll = side === 1 ? low : 1 - low;
  return (p * lh) / (p * lh + (1 - p) * ll);
}

export interface GMQuotes {
  bid: number;
  ask: number;
  mid: number;
  /** Probability, given the public information, that the next trade is a buy. */
  pBuy: number;
}

/** The zero-profit quotes for belief p. */
export function gmQuotes(p: number, { alpha, vL, vH }: GMParams): GMQuotes {
  const value = (b: number) => vL + b * (vH - vL);
  const { high, low } = buyProbabilities(alpha);
  return {
    ask: value(updateBelief(p, alpha, 1)),
    bid: value(updateBelief(p, alpha, -1)),
    mid: value(p),
    pBuy: p * high + (1 - p) * low,
  };
}

export interface GMTrade {
  side: 1 | -1;
  informed: boolean;
  price: number;
}

export interface GMPath {
  belief: number[];
  bid: number[];
  ask: number[];
  trades: GMTrade[];
  /** Cumulative profit of insiders, of uninformed traders and of the market maker, per share. */
  insiderPnl: number[];
  uninformedPnl: number[];
  makerPnl: number[];
}

/** Simulate n trades when the true value is `truth` (v_H or v_L). */
export function simulateGM(params: GMParams & { p0: number; high: boolean; n: number; seed: number }): GMPath {
  const rng = mulberry32(params.seed);
  const v = params.high ? params.vH : params.vL;
  let p = params.p0, ins = 0, unin = 0, mm = 0;
  const belief = [p], bid: number[] = [], ask: number[] = [], trades: GMTrade[] = [];
  const insiderPnl = [0], uninformedPnl = [0], makerPnl = [0];
  for (let t = 0; t < params.n; t++) {
    const q = gmQuotes(p, params);
    bid.push(q.bid);
    ask.push(q.ask);
    const informed = rng() < params.alpha;
    const side: 1 | -1 = informed ? (params.high ? 1 : -1) : rng() < 0.5 ? 1 : -1;
    const price = side === 1 ? q.ask : q.bid;
    const traderGain = side * (v - price);
    if (informed) ins += traderGain; else unin += traderGain;
    mm -= traderGain;
    trades.push({ side, informed, price });
    p = updateBelief(p, params.alpha, side);
    belief.push(p);
    insiderPnl.push(ins);
    uninformedPnl.push(unin);
    makerPnl.push(mm);
  }
  return { belief, bid, ask, trades, insiderPnl, uninformedPnl, makerPnl };
}

/**
 * Expected drift of the log-likelihood ratio ln(p/(1 − p)) per trade when the
 * value is high: α·ln((1 + α)/(1 − α)) ≈ 2α² for small α. Learning takes on the
 * order of 1/α² trades.
 */
export function learningRate(alpha: number): number {
  return alpha * Math.log((1 + alpha) / (1 - alpha));
}

/**
 * Average cumulative profits per share of insiders, uninformed traders and the
 * market maker over many simulated sequences, half with each true value (the
 * market maker's prior). The market maker's average is zero up to noise.
 */
export function averageProfits(params: GMParams & { n: number; runs: number; seed: number }): { insider: number[]; uninformed: number[]; maker: number[] } {
  const insider = new Array<number>(params.n + 1).fill(0);
  const uninformed = [...insider], maker = [...insider];
  for (let k = 0; k < params.runs; k++) {
    const path = simulateGM({ ...params, p0: 0.5, high: k % 2 === 0, seed: params.seed + k });
    for (let t = 0; t <= params.n; t++) {
      insider[t] += path.insiderPnl[t] / params.runs;
      uninformed[t] += path.uninformedPnl[t] / params.runs;
      maker[t] += path.makerPnl[t] / params.runs;
    }
  }
  return { insider, uninformed, maker };
}
