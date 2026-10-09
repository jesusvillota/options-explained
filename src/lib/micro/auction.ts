import { mulberry32 } from '../math/rng';

/**
 * A call auction (Chapter 45): orders are collected, then all trade at once at
 * a single price, the one that lets the most contracts change hands.
 */

export interface AuctionOrder {
  id: number;
  side: 'buy' | 'sell';
  /** Limit price; null for a market order (buy at any price / sell at any price). */
  limit: number | null;
  size: number;
  owner: string;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Demand at price p: contracts that buyers will take at p (limit at or above p, or no limit). */
export function demandAt(orders: AuctionOrder[], p: number): number {
  return orders.filter((o) => o.side === 'buy' && (o.limit === null || o.limit >= p - 1e-9)).reduce((a, o) => a + o.size, 0);
}

/** Supply at price p: contracts that sellers will give at p (limit at or below p, or no limit). */
export function supplyAt(orders: AuctionOrder[], p: number): number {
  return orders.filter((o) => o.side === 'sell' && (o.limit === null || o.limit <= p + 1e-9)).reduce((a, o) => a + o.size, 0);
}

/** Every tick price from lo to hi inclusive. */
export function priceGrid(lo: number, hi: number, tick: number): number[] {
  const out: number[] = [];
  for (let k = Math.round(lo / tick); k <= Math.round(hi / tick) + 1e-9; k++) out.push(round2(k * tick));
  return out;
}

export interface AuctionResult {
  price: number | null;
  volume: number;
  /** Demand minus supply at the clearing price: > 0 means buyers are left over. */
  imbalance: number;
  /** Contracts each order gets, by id. */
  fills: Map<number, number>;
}

/**
 * The clearing price maximises the executed volume min(D(p), S(p)) over the grid.
 * Ties are broken by the smallest imbalance |D − S|, then by the price closest to
 * the reference price. At that price, orders strictly better than it fill in
 * full; orders limited exactly at it share what's left in time priority.
 */
export function clearAuction(orders: AuctionOrder[], grid: number[], reference: number): AuctionResult {
  let best: { p: number; v: number; imb: number } | null = null;
  for (const p of grid) {
    const d = demandAt(orders, p), s = supplyAt(orders, p);
    const v = Math.min(d, s), imb = d - s;
    if (v <= 0) continue;
    if (
      !best ||
      v > best.v ||
      (v === best.v && Math.abs(imb) < Math.abs(best.imb)) ||
      (v === best.v && Math.abs(imb) === Math.abs(best.imb) && Math.abs(p - reference) < Math.abs(best.p - reference) - 1e-9)
    ) best = { p, v, imb };
  }
  const fills = new Map<number, number>();
  if (!best) return { price: null, volume: 0, imbalance: 0, fills };
  const p = best.p;
  for (const side of ['buy', 'sell'] as const) {
    const eligible = orders.filter((o) => o.side === side && (o.limit === null || (side === 'buy' ? o.limit >= p - 1e-9 : o.limit <= p + 1e-9)));
    // Better-priced orders first (market orders best of all), then time priority (by id).
    const rank = (o: AuctionOrder) => (o.limit === null ? Infinity : side === 'buy' ? o.limit : -o.limit);
    eligible.sort((a, b) => rank(b) - rank(a) || a.id - b.id);
    let left = best.v;
    for (const o of eligible) {
      const take = Math.min(o.size, left);
      fills.set(o.id, take);
      left -= take;
    }
  }
  return { price: p, volume: best.v, imbalance: best.imb, fills };
}

/**
 * A seeded set of opening orders for the three-month $105 call (value ≈ 2.48):
 * buyers' limits scattered below and a little above the value, sellers' above
 * and a little below, plus a couple of market orders.
 */
export function openingOrders(seed = 45, n = 12): AuctionOrder[] {
  const rng = mulberry32(seed);
  const orders: AuctionOrder[] = [];
  let id = 1;
  const tick = 0.05;
  for (let i = 0; i < n; i++) {
    const k = Math.round((rng() + rng() + rng() - 1.5) * 4); // roughly −6…6 ticks
    orders.push({ id: id++, side: 'buy', limit: round2(2.45 + Math.min(k, 3) * tick), size: 5 * (1 + Math.floor(rng() * 6)), owner: 'other' });
    const j = Math.round((rng() + rng() + rng() - 1.5) * 4);
    orders.push({ id: id++, side: 'sell', limit: round2(2.5 + Math.max(j, -3) * tick), size: 5 * (1 + Math.floor(rng() * 6)), owner: 'other' });
  }
  orders.push({ id: id++, side: 'buy', limit: null, size: 10, owner: 'other' });
  orders.push({ id: id++, side: 'sell', limit: null, size: 5, owner: 'other' });
  return orders;
}
