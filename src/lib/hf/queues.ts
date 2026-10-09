import { mulberry32 } from '../math/rng';

/**
 * Queues at the best bid and ask (Chapter 71), after Cont and de Larrard
 * (2013). Each best queue gains a lot at rate λ (new limit orders) and loses a
 * lot at rate μ (market orders and cancellations). When the ask queue empties
 * first the mid ticks up; when the bid queue empties first it ticks down.
 * Queue sizes are in lots; `ratio` is λ/μ (below 1: queues tend to shrink).
 */

/**
 * P(up | bid = x, ask = y) for x, y ≤ M, from the embedded jump chain
 *   P(x, y) = [λP(x+1, y) + μP(x−1, y) + λP(x, y+1) + μP(x, y−1)] / (2λ + 2μ),
 * with P(0, y) = 0 and P(x, 0) = 1. Queues can't grow beyond M (arrivals are
 * then refused). Solved by Gauss–Seidel iteration.
 */
export function upProbabilityGrid(M: number, ratio: number): number[][] {
  const lam = ratio / (1 + ratio), mu = 1 / (1 + ratio); // only the ratio matters
  const P = Array.from({ length: M + 1 }, (_, x) => Array.from({ length: M + 1 }, (_, y) => (x === 0 ? 0 : y === 0 ? 1 : x / (x + y))));
  for (let it = 0; it < 5000; it++) {
    let change = 0;
    for (let x = 1; x <= M; x++) {
      for (let y = 1; y <= M; y++) {
        const up = x < M ? lam : 0, right = y < M ? lam : 0;
        const total = up + right + 2 * mu;
        const v = (up * (x < M ? P[x + 1][y] : 0) + mu * P[x - 1][y] + right * (y < M ? P[x][y + 1] : 0) + mu * P[x][y - 1]) / total;
        change = Math.max(change, Math.abs(v - P[x][y]));
        P[x][y] = v;
      }
    }
    if (change < 1e-10) break;
  }
  return P;
}

const cache = new Map<string, number[][]>();
/** P(next mid move is up) with x lots at the bid and y at the ask. */
export function upProbability(x: number, y: number, ratio: number, M = 40): number {
  const key = `${M}:${ratio}`;
  if (!cache.has(key)) cache.set(key, upProbabilityGrid(M, ratio));
  const P = cache.get(key)!;
  return P[Math.min(Math.round(x), M)][Math.min(Math.round(y), M)];
}

/** Order-book imbalance ι = V_b / (V_b + V_a). */
export const imbalance = (vb: number, va: number) => vb / (vb + va);

/** The weighted mid: bid + ι (ask − bid), leaning towards the side with less depth. */
export const weightedMid = (bid: number, ask: number, vb: number, va: number) => bid + imbalance(vb, va) * (ask - bid);

/**
 * A queue-based fair price: the expected mid after the next price move,
 * mid + (2P_up − 1) · tick, when each move shifts the mid by one tick.
 */
export const queueMicroprice = (mid: number, tick: number, pUp: number) => mid + (2 * pUp - 1) * tick;

/** One race from (x, y) until a queue empties: the path of queue sizes and the outcome. */
export function simulateRace(x: number, y: number, ratio: number, seed: number, M = 40): { path: [number, number][]; up: boolean } {
  const u = mulberry32(seed);
  const lam = ratio / (1 + ratio), mu = 1 / (1 + ratio);
  const path: [number, number][] = [[x, y]];
  let b = x, a = y;
  while (b > 0 && a > 0) {
    const r = u() * (2 * lam + 2 * mu);
    if (r < lam) b = Math.min(b + 1, M);
    else if (r < 2 * lam) a = Math.min(a + 1, M);
    else if (r < 2 * lam + mu) b--;
    else a--;
    path.push([b, a]);
  }
  return { path, up: a === 0 };
}

/** Share of n races that end with an up-move. */
export function raceShare(x: number, y: number, ratio: number, n: number, seed: number): number {
  let up = 0;
  for (let i = 0; i < n; i++) if (simulateRace(x, y, ratio, seed + i * 7919).up) up++;
  return up / n;
}

/* ------------------------------------------------------------------------- */
/* Order-flow imbalance                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Simulate the best quotes over many intervals and record each interval's
 * order-flow imbalance (Cont, Kukanov and Stoikov 2014) and mid-price change.
 * After a queue empties, the price moves one tick and both new best queues
 * start at `depth` lots. OFI per event:
 *   e = 1{b ≥ b₋}q_b − 1{b ≤ b₋}q_b₋ − 1{a ≤ a₋}q_a + 1{a ≥ a₋}q_a₋.
 */
export function simulateOfi(o: { intervals: number; eventsPerInterval: number; ratio: number; depth: number; seed: number }): { ofi: number[]; dmid: number[] } {
  const u = mulberry32(o.seed);
  const lam = o.ratio / (1 + o.ratio), mu = 1 / (1 + o.ratio);
  let bid = 0, ask = 1, qb = o.depth, qa = o.depth; // prices in ticks
  const ofi: number[] = [], dmid: number[] = [];
  for (let i = 0; i < o.intervals; i++) {
    const mid0 = (bid + ask) / 2;
    let e = 0;
    for (let k = 0; k < o.eventsPerInterval; k++) {
      const pb = bid, pa = ask, sb = qb, sa = qa;
      const r = u() * (2 * lam + 2 * mu);
      if (r < lam) qb++;
      else if (r < 2 * lam) qa++;
      else if (r < 2 * lam + mu) qb--;
      else qa--;
      if (qb === 0) { bid--; ask--; qb = o.depth; qa = o.depth; }
      else if (qa === 0) { bid++; ask++; qb = o.depth; qa = o.depth; }
      e += (bid >= pb ? qb : 0) - (bid <= pb ? sb : 0) - (ask <= pa ? qa : 0) + (ask >= pa ? sa : 0);
    }
    ofi.push(e);
    dmid.push((bid + ask) / 2 - mid0);
  }
  return { ofi, dmid };
}

/** Least-squares slope through the origin and R² for y ≈ βx. */
export function fitThroughOrigin(x: number[], y: number[]): { slope: number; r2: number } {
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += x[i] * y[i];
    sxx += x[i] * x[i];
    syy += y[i] * y[i];
  }
  const slope = sxy / sxx;
  return { slope, r2: (slope * sxy) / syy };
}
