import { makeBook, priceTime, type Allocation, type Book, type Order, type OrderSide } from './orderBook';

/**
 * Matching rules and fragmented markets (Chapter 44): how one price level is
 * shared among the orders resting there, and how an order is routed across
 * several exchanges that trade the same option.
 */

export { priceTime };

/**
 * Hand out `extra` single contracts in time priority to orders that still have
 * room. Used to place what's left after rounding pro-rata shares down.
 */
function topUp(sizes: number[], shares: number[], extra: number): number[] {
  const out = [...shares];
  let left = extra;
  while (left > 0) {
    let gave = false;
    for (let i = 0; i < out.length && left > 0; i++) {
      if (out[i] < sizes[i]) {
        out[i]++;
        left--;
        gave = true;
      }
    }
    if (!gave) break;
  }
  return out;
}

/**
 * Pro-rata: each order gets ⌊Q·sᵢ/Σs⌋, and the few contracts lost to rounding go
 * one at a time to orders in time priority. Arrival time matters only for those
 * leftovers; size is what counts.
 */
export const proRata: Allocation = (orders, qty) => {
  const sizes = orders.map((o) => o.size);
  const total = sizes.reduce((a, b) => a + b, 0);
  const q = Math.min(qty, total);
  if (q <= 0 || total === 0) return sizes.map(() => 0);
  const base = sizes.map((s) => Math.floor((q * s) / total));
  return topUp(sizes, base, q - base.reduce((a, b) => a + b, 0));
};

const isCustomer = (o: Order) => o.owner === 'customer';

/**
 * Public customers first, in time priority; whatever is left is shared pro rata
 * among the professionals.
 */
export const customerPriority: Allocation = (orders, qty) => {
  const shares = orders.map(() => 0);
  let left = qty;
  orders.forEach((o, i) => {
    if (isCustomer(o) && left > 0) {
      shares[i] = Math.min(o.size, left);
      left -= shares[i];
    }
  });
  const pros = orders.map((o, i) => ({ o, i })).filter(({ o }) => !isCustomer(o));
  const rest = proRata(pros.map(({ o }) => o), left);
  pros.forEach(({ i }, k) => (shares[i] = rest[k]));
  return shares;
};

/**
 * Customer priority, then a participation entitlement: the lead market maker
 * (owner 'lmm') gets a fixed share of what's left (capped by its size), and the
 * remainder goes pro rata to the other professionals. If they can't absorb it
 * all, the lead market maker takes the rest.
 */
export function leadMarketMaker(share = 0.4): Allocation {
  return (orders, qty) => {
    const shares = orders.map(() => 0);
    let left = qty;
    orders.forEach((o, i) => {
      if (isCustomer(o) && left > 0) {
        shares[i] = Math.min(o.size, left);
        left -= shares[i];
      }
    });
    const lead = orders.findIndex((o) => o.owner === 'lmm');
    if (lead >= 0 && left > 0) {
      shares[lead] = Math.min(orders[lead].size, Math.floor(share * left));
      left -= shares[lead];
    }
    const others = orders.map((o, i) => ({ o, i })).filter(({ o, i }) => !isCustomer(o) && i !== lead);
    const rest = proRata(others.map(({ o }) => o), left);
    others.forEach(({ i }, k) => (shares[i] = rest[k]));
    left -= rest.reduce((a, b) => a + b, 0);
    if (lead >= 0 && left > 0) {
      const extra = Math.min(orders[lead].size - shares[lead], left);
      shares[lead] += extra;
    }
    return shares;
  };
}

export type RuleName = 'priceTime' | 'proRata' | 'customer' | 'lmm';

export const RULES: Record<RuleName, Allocation> = {
  priceTime,
  proRata,
  customer: customerPriority,
  lmm: leadMarketMaker(0.4),
};

// ---------------------------------------------------------------------------
// Many venues

export interface Venue {
  name: string;
  book: Book;
  /** Fee charged to a taker, in dollars per contract (negative = rebate). */
  takeFee: number;
  /** Fee charged to a maker, in dollars per contract (negative = rebate). */
  makeFee: number;
}

export interface NBBO {
  bid: number | null;
  ask: number | null;
  /** Indices of the venues at the best bid / best ask. */
  bidVenues: number[];
  askVenues: number[];
}

/** National best bid and offer: the highest bid and the lowest ask across all venues. */
export function nbbo(venues: Venue[]): NBBO {
  let bid: number | null = null, ask: number | null = null;
  for (const v of venues) {
    const b = v.book.bids[0]?.price, a = v.book.asks[0]?.price;
    if (b !== undefined && (bid === null || b > bid)) bid = b;
    if (a !== undefined && (ask === null || a < ask)) ask = a;
  }
  const at = (side: 'bids' | 'asks', p: number | null) =>
    venues.map((v, i) => (p !== null && Math.abs((v.book[side][0]?.price ?? NaN) - p) < 1e-9 ? i : -1)).filter((i) => i >= 0);
  return { bid, ask, bidVenues: at('bids', bid), askVenues: at('asks', ask) };
}

/** The consolidated book: every venue's size at each price, merged, best price first. */
export function consolidated(venues: Venue[], side: 'bid' | 'ask'): { price: number; size: number; byVenue: number[] }[] {
  const map = new Map<number, number[]>();
  venues.forEach((v, i) => {
    for (const l of side === 'bid' ? v.book.bids : v.book.asks) {
      const key = Math.round(l.price * 100);
      const row = map.get(key) ?? venues.map(() => 0);
      row[i] += l.orders.reduce((a, o) => a + o.size, 0);
      map.set(key, row);
    }
  });
  return [...map.entries()]
    .sort((x, y) => (side === 'bid' ? y[0] - x[0] : x[0] - y[0]))
    .map(([k, byVenue]) => ({ price: k / 100, size: byVenue.reduce((a, b) => a + b, 0), byVenue }));
}

export interface RoutedFill {
  venue: number;
  price: number;
  size: number;
  /** Fee paid on this fill, in dollars (negative = rebate received). */
  fee: number;
}

export interface RouteResult {
  fills: RoutedFill[];
  filled: number;
  /** Average price per share, before fees. */
  avgPrice: number;
  /** Total fees in dollars. */
  fees: number;
  /** Average price per share after fees: fees make a buy dearer and a sale cheaper. */
  netAvgPrice: number;
  /**
   * Contracts that traded at a price worse than the best price displayed
   * elsewhere at that moment: trade-throughs, which order-protection rules forbid.
   */
  tradeThroughs: number;
}

/**
 * Route a marketable order across venues, without changing the books.
 *  - 'smart': always take the best displayed price anywhere (so no trade-throughs);
 *    among venues at the same price, the lowest taker fee goes first.
 *  - a venue index: send everything to that one venue and walk its book.
 */
export function routeOrder(venues: Venue[], side: OrderSide, Q: number, mode: 'smart' | number, multiplier = 100): RouteResult {
  // Remaining size at each venue's levels (best first), on the side we trade against.
  const books = venues.map((v) => (side === 'buy' ? v.book.asks : v.book.bids).map((l) => ({ price: l.price, size: l.orders.reduce((a, o) => a + o.size, 0) })));
  const better = (p: number, q: number) => (side === 'buy' ? p < q - 1e-9 : p > q + 1e-9);
  const fills: RoutedFill[] = [];
  let left = Q, tradeThroughs = 0;
  while (left > 0) {
    const candidates = books.map((lv, i) => ({ i, level: lv.find((l) => l.size > 0) })).filter((c) => c.level);
    if (!candidates.length) break;
    const bestPrice = candidates.reduce((p, c) => (better(c.level!.price, p) ? c.level!.price : p), candidates[0].level!.price);
    let pick: number;
    if (mode === 'smart') {
      const atBest = candidates.filter((c) => Math.abs(c.level!.price - bestPrice) < 1e-9);
      atBest.sort((x, y) => venues[x.i].takeFee - venues[y.i].takeFee || x.i - y.i);
      pick = atBest[0].i;
    } else {
      if (!candidates.some((c) => c.i === mode)) break;
      pick = mode;
    }
    const level = books[pick].find((l) => l.size > 0)!;
    const take = Math.min(level.size, left);
    if (better(bestPrice, level.price)) tradeThroughs += take;
    fills.push({ venue: pick, price: level.price, size: take, fee: take * venues[pick].takeFee });
    level.size -= take;
    left -= take;
  }
  const filled = Q - left;
  const notional = fills.reduce((a, f) => a + f.price * f.size, 0);
  const fees = fills.reduce((a, f) => a + f.fee, 0);
  const avgPrice = filled ? notional / filled : NaN;
  const feePerShare = filled ? fees / (filled * multiplier) : 0;
  return { fills, filled, avgPrice, fees, netAvgPrice: side === 'buy' ? avgPrice + feePerShare : avgPrice - feePerShare, tradeThroughs };
}

/**
 * The three-exchange market of Chapter 44, for the three-month $105 call.
 * Fees are per contract and illustrative: A charges takers and pays makers a
 * rebate (maker–taker), B charges both sides a small flat fee, C is "inverted"
 * (takers get a small rebate, makers pay).
 */
export function threeVenues(): Venue[] {
  return [
    {
      name: 'A',
      takeFee: 0.5,
      makeFee: -0.25,
      book: makeBook(0.05,
        [{ price: 2.4, orders: [20] }, { price: 2.35, orders: [30] }, { price: 2.3, orders: [40] }],
        [{ price: 2.55, orders: [15] }, { price: 2.6, orders: [25] }, { price: 2.65, orders: [30] }]),
    },
    {
      name: 'B',
      takeFee: 0.2,
      makeFee: 0.2,
      book: makeBook(0.05,
        [{ price: 2.45, orders: [8] }, { price: 2.4, orders: [15] }, { price: 2.35, orders: [25] }],
        [{ price: 2.6, orders: [20] }, { price: 2.65, orders: [30] }, { price: 2.7, orders: [40] }]),
    },
    {
      name: 'C',
      takeFee: -0.05,
      makeFee: 0.3,
      book: makeBook(0.05,
        [{ price: 2.4, orders: [10] }, { price: 2.35, orders: [20] }, { price: 2.3, orders: [30] }],
        [{ price: 2.5, orders: [5] }, { price: 2.55, orders: [20] }, { price: 2.6, orders: [30] }]),
    },
  ];
}
