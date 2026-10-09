import type { Rng } from '../math/rng';

/**
 * A limit order book with a small matching engine (Chapter 43).
 *
 * Prices are in dollars per share and always sit on the tick grid; sizes are in
 * contracts. Books are immutable: every operation returns a new book.
 */

export type BookSide = 'bid' | 'ask';
export type OrderSide = 'buy' | 'sell';

export interface Order {
  id: number;
  side: BookSide;
  price: number;
  size: number;
  /** Who placed it: 'you' for the reader, otherwise e.g. 'mm' (market maker) or 'customer'. */
  owner: string;
}

/** All the resting orders at one price, in time priority (first in, first out). */
export interface Level {
  price: number;
  orders: Order[];
}

export interface Book {
  tick: number;
  /** Best (highest) bid first. */
  bids: Level[];
  /** Best (lowest) ask first. */
  asks: Level[];
  nextId: number;
}

export interface Fill {
  price: number;
  size: number;
  makerId: number;
  makerOwner: string;
}

export interface OrderResult {
  book: Book;
  fills: Fill[];
  /** Contracts traded on arrival. */
  filled: number;
  /** Id of the part left resting in the book, if any. */
  restingId: number | null;
  /** Contracts neither filled nor resting (a market order that ran out of book). */
  unfilled: number;
}

/**
 * How an incoming order of `qty` contracts is shared among the orders resting at
 * one price. Returns how much each resting order gets, in the same order.
 */
export type Allocation = (orders: Order[], qty: number) => number[];

/** Price–time priority: the earliest order at the price fills first, in full. */
export const priceTime: Allocation = (orders, qty) => {
  let left = qty;
  return orders.map((o) => {
    const take = Math.min(o.size, left);
    left -= take;
    return take;
  });
};

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Snap a price to the tick grid (to the nearest tick). */
export function toTick(price: number, tick: number): number {
  return round2(Math.round(price / tick) * tick);
}

const bookSideOf = (side: OrderSide): BookSide => (side === 'buy' ? 'bid' : 'ask');
const levelSize = (l: Level) => l.orders.reduce((a, o) => a + o.size, 0);

export interface LevelSpec {
  price: number;
  /** Order sizes in time priority; each may carry an owner. */
  orders: (number | { size: number; owner: string })[];
}

/** Build a book from lists of levels (any order; they get sorted). */
export function makeBook(tick: number, bids: LevelSpec[], asks: LevelSpec[]): Book {
  let nextId = 1;
  const build = (side: BookSide, specs: LevelSpec[]): Level[] =>
    specs.map((s) => ({
      price: toTick(s.price, tick),
      orders: s.orders.map((o) => {
        const { size, owner } = typeof o === 'number' ? { size: o, owner: 'mm' } : o;
        return { id: nextId++, side, price: toTick(s.price, tick), size, owner };
      }),
    }));
  const b = build('bid', bids).sort((x, y) => y.price - x.price);
  const a = build('ask', asks).sort((x, y) => x.price - y.price);
  return { tick, bids: b, asks: a, nextId };
}

export function bestBid(book: Book): number | null {
  return book.bids.length ? book.bids[0].price : null;
}

export function bestAsk(book: Book): number | null {
  return book.asks.length ? book.asks[0].price : null;
}

/** Mid-price ½(b + a), or null if either side is empty. */
export function midPrice(book: Book): number | null {
  const b = bestBid(book), a = bestAsk(book);
  return b === null || a === null ? null : (b + a) / 2;
}

/** Quoted spread a − b. */
export function quotedSpread(book: Book): number | null {
  const b = bestBid(book), a = bestAsk(book);
  return b === null || a === null ? null : round2(a - b);
}

/** Total size at each price on one side, best price first. */
export function levelsOf(book: Book, side: BookSide): { price: number; size: number }[] {
  return (side === 'bid' ? book.bids : book.asks).map((l) => ({ price: l.price, size: levelSize(l) }));
}

/** Cumulative depth: the total size available at this price or better, best price first. */
export function cumulativeDepth(book: Book, side: BookSide): { price: number; cum: number }[] {
  let cum = 0;
  return levelsOf(book, side).map((l) => ({ price: l.price, cum: (cum += l.size) }));
}

/** The resting order with this id, or null if it has filled or been cancelled. */
export function findOrder(book: Book, id: number): Order | null {
  for (const l of [...book.bids, ...book.asks]) for (const o of l.orders) if (o.id === id) return o;
  return null;
}

/**
 * How many contracts must trade before a resting order starts to fill: everything
 * on its side at better prices, plus the orders ahead of it at its own price.
 */
export function queueAhead(book: Book, id: number): number | null {
  for (const levels of [book.bids, book.asks]) {
    let ahead = 0;
    for (const l of levels) {
      for (const o of l.orders) {
        if (o.id === id) return ahead;
        ahead += o.size;
      }
    }
  }
  return null;
}

/**
 * Match an incoming order against the opposite side, best price first, while the
 * price is acceptable. Returns the new opposite side, the fills and what's left.
 */
function sweep(levels: Level[], side: OrderSide, qty: number, limit: number | null, allocate: Allocation) {
  const fills: Fill[] = [];
  const out: Level[] = [];
  let left = qty;
  for (const level of levels) {
    const acceptable = limit === null || (side === 'buy' ? level.price <= limit + 1e-9 : level.price >= limit - 1e-9);
    if (left <= 0 || !acceptable) {
      out.push(level);
      continue;
    }
    const total = levelSize(level);
    const take = Math.min(total, left);
    const shares = allocate(level.orders, take);
    const orders: Order[] = [];
    level.orders.forEach((o, i) => {
      if (shares[i] > 0) fills.push({ price: level.price, size: shares[i], makerId: o.id, makerOwner: o.owner });
      if (o.size - shares[i] > 0) orders.push({ ...o, size: o.size - shares[i] });
    });
    left -= take;
    if (orders.length) out.push({ ...level, orders });
  }
  return { levels: out, fills, left };
}

function rest(levels: Level[], order: Order, side: BookSide): Level[] {
  const better = (p: number, q: number) => (side === 'bid' ? p > q + 1e-9 : p < q - 1e-9);
  const out = levels.map((l) => ({ ...l, orders: [...l.orders] }));
  const at = out.findIndex((l) => Math.abs(l.price - order.price) < 1e-9);
  if (at >= 0) {
    out[at].orders.push(order);
    return out;
  }
  const i = out.findIndex((l) => better(order.price, l.price));
  const level = { price: order.price, orders: [order] };
  if (i < 0) out.push(level);
  else out.splice(i, 0, level);
  return out;
}

/**
 * Send a limit order. If its price crosses the opposite best quote it trades
 * first (a marketable limit order), never at a worse price than its limit; any
 * remainder rests in the book at the back of the queue at its price.
 */
export function submitLimit(
  book: Book,
  { side, price, size, owner = 'you' }: { side: OrderSide; price: number; size: number; owner?: string },
  allocate: Allocation = priceTime,
): OrderResult {
  const p = toTick(price, book.tick);
  const opposite = side === 'buy' ? book.asks : book.bids;
  const { levels, fills, left } = sweep(opposite, side, size, p, allocate);
  let next: Book = side === 'buy' ? { ...book, asks: levels } : { ...book, bids: levels };
  let restingId: number | null = null;
  if (left > 0) {
    const bs = bookSideOf(side);
    const order: Order = { id: next.nextId, side: bs, price: p, size: left, owner };
    restingId = order.id;
    next = bs === 'bid'
      ? { ...next, nextId: next.nextId + 1, bids: rest(next.bids, order, bs) }
      : { ...next, nextId: next.nextId + 1, asks: rest(next.asks, order, bs) };
  }
  return { book: next, fills, filled: size - left, restingId, unfilled: 0 };
}

/** Send a market order: trade at whatever prices it takes, until filled or the book runs out. */
export function submitMarket(
  book: Book,
  { side, size }: { side: OrderSide; size: number },
  allocate: Allocation = priceTime,
): OrderResult {
  const opposite = side === 'buy' ? book.asks : book.bids;
  const { levels, fills, left } = sweep(opposite, side, size, null, allocate);
  const next: Book = side === 'buy' ? { ...book, asks: levels } : { ...book, bids: levels };
  return { book: next, fills, filled: size - left, restingId: null, unfilled: left };
}

/** Remove a resting order. */
export function cancelOrder(book: Book, id: number): Book {
  const drop = (levels: Level[]) =>
    levels.map((l) => ({ ...l, orders: l.orders.filter((o) => o.id !== id) })).filter((l) => l.orders.length > 0);
  return { ...book, bids: drop(book.bids), asks: drop(book.asks) };
}

/** Volume-weighted average price of a list of fills (null if empty). */
export function averagePrice(fills: Fill[]): number | null {
  const q = fills.reduce((a, f) => a + f.size, 0);
  return q > 0 ? fills.reduce((a, f) => a + f.price * f.size, 0) / q : null;
}

export interface WalkResult {
  /** Contracts filled (less than asked if the book runs out). */
  filled: number;
  /** Σ pᵢqᵢ, in dollars per share × contracts. */
  cost: number;
  /** Average fill price p̄ = cost / filled. */
  avgPrice: number;
  /** Price of the last (worst) contract filled. */
  marginalPrice: number;
  /** How many price levels the order touched. */
  levelsUsed: number;
  /** The fills level by level: (price, size). */
  fills: { price: number; size: number }[];
}

/**
 * Walk the book: fill a market order of size Q against levels (best first),
 * without changing anything. This is the pure arithmetic of slippage.
 */
export function walkTheBook(levels: { price: number; size: number }[], Q: number): WalkResult {
  let left = Q, cost = 0, marginalPrice = levels.length ? levels[0].price : NaN;
  const fills: { price: number; size: number }[] = [];
  for (const l of levels) {
    if (left <= 0) break;
    const q = Math.min(l.size, left);
    fills.push({ price: l.price, size: q });
    cost += q * l.price;
    left -= q;
    marginalPrice = l.price;
  }
  const filled = Q - left;
  return { filled, cost, avgPrice: filled > 0 ? cost / filled : NaN, marginalPrice, levelsUsed: fills.length, fills };
}

/**
 * The book used throughout Part XI: the three-month $105 call of Chapter 4
 * (Black–Scholes value about $2.48), quoted 2.40 bid, 2.55 ask on a $0.05 tick.
 * Depth grows away from the touch, and each level holds a few orders.
 */
export const CALL_BOOK_BIDS: LevelSpec[] = [
  { price: 2.4, orders: [{ size: 12, owner: 'mm' }, { size: 8, owner: 'customer' }] },
  { price: 2.35, orders: [{ size: 15, owner: 'mm' }, { size: 10, owner: 'customer' }, { size: 5, owner: 'customer' }] },
  { price: 2.3, orders: [{ size: 20, owner: 'mm' }, { size: 15, owner: 'customer' }] },
  { price: 2.25, orders: [{ size: 25, owner: 'customer' }, { size: 20, owner: 'mm' }] },
  { price: 2.2, orders: [{ size: 30, owner: 'mm' }, { size: 25, owner: 'customer' }] },
  { price: 2.15, orders: [{ size: 40, owner: 'mm' }, { size: 25, owner: 'customer' }] },
  { price: 2.1, orders: [{ size: 50, owner: 'customer' }, { size: 25, owner: 'mm' }] },
  { price: 2.05, orders: [{ size: 50, owner: 'mm' }, { size: 40, owner: 'customer' }] },
  { price: 2.0, orders: [{ size: 60, owner: 'customer' }, { size: 50, owner: 'mm' }] },
];

export const CALL_BOOK_ASKS: LevelSpec[] = [
  { price: 2.55, orders: [{ size: 10, owner: 'mm' }, { size: 5, owner: 'customer' }] },
  { price: 2.6, orders: [{ size: 12, owner: 'customer' }, { size: 8, owner: 'mm' }, { size: 5, owner: 'customer' }] },
  { price: 2.65, orders: [{ size: 20, owner: 'mm' }, { size: 10, owner: 'customer' }] },
  { price: 2.7, orders: [{ size: 25, owner: 'mm' }, { size: 15, owner: 'customer' }] },
  { price: 2.75, orders: [{ size: 30, owner: 'customer' }, { size: 20, owner: 'mm' }] },
  { price: 2.8, orders: [{ size: 40, owner: 'mm' }, { size: 20, owner: 'customer' }] },
  { price: 2.85, orders: [{ size: 50, owner: 'mm' }, { size: 20, owner: 'customer' }] },
  { price: 2.9, orders: [{ size: 50, owner: 'customer' }, { size: 30, owner: 'mm' }] },
  { price: 2.95, orders: [{ size: 60, owner: 'mm' }, { size: 40, owner: 'customer' }] },
];

export const CALL_BOOK_TICK = 0.05;

/** The Part XI call book, with every size multiplied by `depth` (rounded, at least 1). */
export function callBook(depth = 1): Book {
  const scale = (specs: LevelSpec[]) =>
    specs.map((s) => ({
      price: s.price,
      orders: s.orders.map((o) => (typeof o === 'number' ? Math.max(1, Math.round(o * depth)) : { ...o, size: Math.max(1, Math.round(o.size * depth)) })),
    }));
  return makeBook(CALL_BOOK_TICK, scale(CALL_BOOK_BIDS), scale(CALL_BOOK_ASKS));
}

export interface FlowParams {
  /** Where new bids and asks cluster: the usual best bid and best ask. */
  homeBid: number;
  homeAsk: number;
  /** Relative frequencies of the three kinds of event. */
  limitRate: number;
  cancelRate: number;
  marketRate: number;
  /** Number of resting orders the cancellation rate is calibrated to. */
  typicalOrders: number;
}

export const DEFAULT_FLOW: FlowParams = {
  homeBid: 2.4,
  homeAsk: 2.55,
  limitRate: 0.45,
  cancelRate: 0.3,
  marketRate: 0.25,
  typicalOrders: 40,
};

export interface FlowEvent {
  book: Book;
  kind: 'limit' | 'cancel' | 'market';
  side: OrderSide;
  size: number;
  price: number | null;
  fills: Fill[];
}

/**
 * One event of other traders' order flow, in the spirit of "zero-intelligence"
 * models: a new limit order near the usual quotes, a cancellation of a random
 * order (never the reader's), or a small market order. Cancellations speed up
 * when the book is fuller than usual, which keeps it from growing or emptying.
 */
export function randomEvent(book: Book, rng: Rng, flow: FlowParams = DEFAULT_FLOW): FlowEvent {
  const others = [...book.bids, ...book.asks].flatMap((l) => l.orders).filter((o) => o.owner !== 'you');
  const cancelWeight = flow.cancelRate * (others.length / flow.typicalOrders);
  const total = flow.limitRate + cancelWeight + flow.marketRate;
  const u = rng() * total;
  const side: OrderSide = rng() < 0.5 ? 'buy' : 'sell';
  // Limit orders are 5–40 contracts; market orders are usually smaller.
  const limitSize = 5 * (1 + Math.floor(rng() * 8));
  const marketSize = 5 * (1 + Math.floor(rng() * rng() * 8));

  if (u < flow.limitRate) {
    // Distance from the usual quote, in ticks: −1 (improving the quote) is rare,
    // then geometrically less likely the further away.
    let k = rng() < 0.08 ? -1 : 0;
    while (k >= 0 && k < 8 && rng() < 0.65) k++;
    const owner = rng() < 0.6 ? 'mm' : 'customer';
    let price = side === 'buy' ? flow.homeBid - k * book.tick : flow.homeAsk + k * book.tick;
    // Rest, don't trade: never cross the other side.
    const a = bestAsk(book), b = bestBid(book);
    if (side === 'buy' && a !== null && price >= a - 1e-9) price = a - book.tick;
    if (side === 'sell' && b !== null && price <= b + 1e-9) price = b + book.tick;
    const res = submitLimit(book, { side, price, size: limitSize, owner });
    return { book: res.book, kind: 'limit', side, size: limitSize, price: toTick(price, book.tick), fills: res.fills };
  }
  if (u < flow.limitRate + cancelWeight && others.length > 0) {
    const o = others[Math.floor(rng() * others.length)];
    return { book: cancelOrder(book, o.id), kind: 'cancel', side: o.side === 'bid' ? 'buy' : 'sell', size: o.size, price: o.price, fills: [] };
  }
  const res = submitMarket(book, { side, size: marketSize });
  return { book: res.book, kind: 'market', side, size: marketSize, price: null, fills: res.fills };
}
