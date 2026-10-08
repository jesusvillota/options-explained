import { mulberry32, normalRng } from '../math/rng';

/**
 * A dealer's inventory problem (Chapter 49).
 *
 * Customers arrive at random and trade at the dealer's quotes. The closer a
 * quote is to the fair value, the more often it is hit: a customer buys at the
 * ask with intensity A·e^{−k(a − v)} and sells at the bid with intensity
 * A·e^{−k(v − b)}. The dealer can shade both quotes against its inventory,
 * centring them on a reservation price r = v − c·q.
 */

export interface DealerParams {
  /** Number of time steps (e.g. minutes in a trading day). */
  steps: number;
  /** Length of a step, in the same units as the arrival rate. */
  dt: number;
  /** Starting fair value. */
  v0: number;
  /** Volatility of the fair value per unit time ($ per √time). */
  sigma: number;
  /** Half-spread around the reservation price. */
  h: number;
  /** Arrival intensity of customers when a quote sits exactly at fair value. */
  A: number;
  /** How fast arrivals fall off as a quote moves away from fair value (per $). */
  k: number;
  /** Shading: dollars by which both quotes move per unit of inventory. 0 = no shading. */
  shade: number;
  seed: number;
}

export interface DealerPath {
  /** Inventory after each step (steps + 1 entries). */
  inventory: number[];
  /** Mark-to-market P&L (cash + inventory × fair value − starting value) after each step. */
  pnl: number[];
  trades: number;
}

/** Simulate one day of a dealer's quotes, fills, inventory and P&L. */
export function simulateDealer(p: DealerParams): DealerPath {
  const z = normalRng(p.seed);
  const u = mulberry32(p.seed + 1000);
  let v = p.v0, q = 0, cash = 0, trades = 0;
  const inventory = [0], pnl = [0];
  for (let i = 0; i < p.steps; i++) {
    const r = v - p.shade * q;
    const ask = r + p.h, bid = r - p.h;
    // Probabilities of a customer buy (at our ask) and sell (at our bid) in this step.
    const pBuy = Math.min(1, p.A * Math.exp(-p.k * (ask - v)) * p.dt);
    const pSell = Math.min(1, p.A * Math.exp(-p.k * (v - bid)) * p.dt);
    if (u() < pBuy) { q -= 1; cash += ask; trades++; }
    if (u() < pSell) { q += 1; cash -= bid; trades++; }
    v += p.sigma * Math.sqrt(p.dt) * z();
    inventory.push(q);
    pnl.push(cash + q * v);
  }
  return { inventory, pnl, trades };
}

export interface DealerStats {
  meanPnl: number;
  sdPnl: number;
  /** Root-mean-square end-of-day inventory. */
  rmsInventory: number;
  meanTrades: number;
  pnls: number[];
}

/** Run many independent days and summarise. */
export function dealerStats(p: Omit<DealerParams, 'seed'>, days: number, seed: number): DealerStats {
  const pnls: number[] = [];
  let inv2 = 0, trades = 0;
  for (let d = 0; d < days; d++) {
    const path = simulateDealer({ ...p, seed: seed + 7919 * d });
    pnls.push(path.pnl[path.pnl.length - 1]);
    inv2 += path.inventory[path.inventory.length - 1] ** 2;
    trades += path.trades;
  }
  const meanPnl = pnls.reduce((a, b) => a + b, 0) / days;
  const sdPnl = Math.sqrt(pnls.reduce((a, b) => a + (b - meanPnl) ** 2, 0) / (days - 1));
  return { meanPnl, sdPnl, rmsInventory: Math.sqrt(inv2 / days), meanTrades: trades / days, pnls };
}

/**
 * The one-period Stoll / Ho–Stoll dealer: constant absolute risk aversion γ, an
 * asset worth v with variance σ²τ over the holding period, and inventory q. The
 * prices at which the dealer is indifferent to buying or selling one more unit are
 *   bid = v − γσ²τ q − ½γσ²τ,   ask = v − γσ²τ q + ½γσ²τ,
 * so the quotes centre on r = v − γσ²τ q and are γσ²τ apart.
 */
export function reservationQuotes(v: number, q: number, gamma: number, sigma2tau: number): { bid: number; ask: number; mid: number; spread: number } {
  const c = gamma * sigma2tau;
  return { bid: v - c * q - c / 2, ask: v - c * q + c / 2, mid: v - c * q, spread: c };
}

/**
 * Inventory under linear shading, as an AR(1): if each step the dealer's
 * inventory moves by ±1 and shading makes the expected move −2βq, then
 * q_{t+1} ≈ (1 − 2β) q_t + noise, with stationary variance about 1/(1 − (1 − 2β)²) ≈ 1/(4β).
 */
export function stationaryInventoryVariance(beta: number): number {
  const phi = 1 - 2 * beta;
  return 1 / (1 - phi * phi);
}
