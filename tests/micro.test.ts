import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/lib/math/rng';
import {
  averagePrice,
  bestAsk,
  bestBid,
  callBook,
  cancelOrder,
  cumulativeDepth,
  findOrder,
  levelsOf,
  makeBook,
  midPrice,
  queueAhead,
  quotedSpread,
  randomEvent,
  submitLimit,
  submitMarket,
  walkTheBook,
} from '../src/lib/micro/orderBook';
import { DEFAULTS, price } from '../src/lib/pricing/blackScholes';
import { consolidated, customerPriority, leadMarketMaker, nbbo, priceTime, proRata, routeOrder, threeVenues } from '../src/lib/micro/matching';
import type { Order } from '../src/lib/micro/orderBook';

const totalSize = (book: ReturnType<typeof callBook>) =>
  [...book.bids, ...book.asks].reduce((a, l) => a + l.orders.reduce((b, o) => b + o.size, 0), 0);

describe('the Part XI call book', () => {
  const book = callBook();

  it('quotes 2.40 / 2.55 around the Black–Scholes value of the three-month $105 call', () => {
    const theo = price('call', { ...DEFAULTS, K: 105, T: 0.25 });
    expect(theo).toBeCloseTo(2.48, 2);
    expect(bestBid(book)).toBe(2.4);
    expect(bestAsk(book)).toBe(2.55);
    expect(midPrice(book)).toBeCloseTo(2.475, 12);
    expect(quotedSpread(book)).toBe(0.15);
    expect(bestBid(book)!).toBeLessThan(theo);
    expect(bestAsk(book)!).toBeGreaterThan(theo);
  });

  it('shows 20 contracts bid and 15 offered at the touch, deeper further away', () => {
    expect(levelsOf(book, 'bid')[0].size).toBe(20);
    expect(levelsOf(book, 'ask')[0].size).toBe(15);
    const asks = levelsOf(book, 'ask').map((l) => l.size);
    for (let i = 1; i < asks.length; i++) expect(asks[i]).toBeGreaterThan(asks[i - 1]);
    expect(cumulativeDepth(book, 'ask').slice(0, 3).map((d) => d.cum)).toEqual([15, 40, 70]);
  });

  it('scales its depth', () => {
    expect(levelsOf(callBook(2), 'ask')[0].size).toBe(30);
  });
});

describe('walking the book', () => {
  const asks = levelsOf(callBook(), 'ask');

  it('fills 100 contracts at 2.55, 2.60, 2.65 and 2.70 for an average of 2.6375', () => {
    const w = walkTheBook(asks, 100);
    expect(w.fills).toEqual([
      { price: 2.55, size: 15 },
      { price: 2.6, size: 25 },
      { price: 2.65, size: 30 },
      { price: 2.7, size: 30 },
    ]);
    expect(w.cost).toBeCloseTo(263.75, 10);
    expect(w.avgPrice).toBeCloseTo(2.6375, 10);
    expect(w.marginalPrice).toBe(2.7);
    expect(w.levelsUsed).toBe(4);
  });

  it('fills 50 contracts for an average of 2.595', () => {
    expect(walkTheBook(asks, 50).avgPrice).toBeCloseTo(2.595, 10);
  });

  it('pays exactly the ask while the order fits in the first level', () => {
    expect(walkTheBook(asks, 15).avgPrice).toBeCloseTo(2.55, 12);
  });

  it('has an average price that rises with size but stays below the marginal price', () => {
    let prev = 0;
    for (let q = 5; q <= 400; q += 5) {
      const w = walkTheBook(asks, q);
      expect(w.avgPrice).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(w.avgPrice).toBeLessThanOrEqual(w.marginalPrice + 1e-12);
      prev = w.avgPrice;
    }
  });

  it('stops when the book runs out', () => {
    const total = asks.reduce((a, l) => a + l.size, 0);
    expect(walkTheBook(asks, total + 50).filled).toBe(total);
  });
});

describe('matching engine', () => {
  it('fills a market buy against the asks in price–time order', () => {
    const res = submitMarket(callBook(), { side: 'buy', size: 50 });
    expect(res.filled).toBe(50);
    expect(averagePrice(res.fills)).toBeCloseTo(2.595, 10);
    // At 2.60 the three orders (12, 8, 5) fill in the order they arrived.
    expect(res.fills.filter((f) => f.price === 2.6).map((f) => f.size)).toEqual([12, 8, 5]);
    // The 2.55 and 2.60 levels are gone; 20 of 30 remain at 2.65.
    expect(bestAsk(res.book)).toBe(2.65);
    expect(levelsOf(res.book, 'ask')[0].size).toBe(20);
    expect(totalSize(res.book)).toBe(totalSize(callBook()) - 50);
  });

  it('rests a limit order inside the spread and makes it the new best bid', () => {
    const res = submitLimit(callBook(), { side: 'buy', price: 2.45, size: 10 });
    expect(res.filled).toBe(0);
    expect(bestBid(res.book)).toBe(2.45);
    expect(quotedSpread(res.book)).toBe(0.1);
    expect(queueAhead(res.book, res.restingId!)).toBe(0);
  });

  it('puts a limit order at the back of the queue at its price', () => {
    const res = submitLimit(callBook(), { side: 'buy', price: 2.4, size: 10 });
    expect(queueAhead(res.book, res.restingId!)).toBe(20);
    // A bid further down waits behind everything at better prices too.
    const deeper = submitLimit(callBook(), { side: 'buy', price: 2.35, size: 10 });
    expect(queueAhead(deeper.book, deeper.restingId!)).toBe(20 + 30);
  });

  it('fills the reader only after the orders ahead have traded', () => {
    let book = submitLimit(callBook(), { side: 'buy', price: 2.4, size: 10 }).book;
    const id = book.nextId - 1;
    const first = submitMarket(book, { side: 'sell', size: 20 });
    expect(findOrder(first.book, id)!.size).toBe(10);
    expect(first.fills.some((f) => f.makerId === id)).toBe(false);
    book = first.book;
    const second = submitMarket(book, { side: 'sell', size: 4 });
    expect(second.fills).toEqual([{ price: 2.4, size: 4, makerId: id, makerOwner: 'you' }]);
    expect(findOrder(second.book, id)!.size).toBe(6);
  });

  it('trades a marketable limit order only up to its limit price, then rests the rest', () => {
    const res = submitLimit(callBook(), { side: 'buy', price: 2.6, size: 60 });
    expect(res.filled).toBe(40);
    expect(Math.max(...res.fills.map((f) => f.price))).toBe(2.6);
    expect(bestBid(res.book)).toBe(2.6);
    expect(levelsOf(res.book, 'bid')[0].size).toBe(20);
    expect(bestAsk(res.book)).toBe(2.65);
  });

  it('reports what a market order could not fill', () => {
    const book = makeBook(0.05, [{ price: 1, orders: [5] }], [{ price: 1.1, orders: [5] }]);
    const res = submitMarket(book, { side: 'sell', size: 8 });
    expect(res.filled).toBe(5);
    expect(res.unfilled).toBe(3);
    expect(bestBid(res.book)).toBeNull();
  });

  it('cancels an order and removes empty levels', () => {
    const res = submitLimit(callBook(), { side: 'sell', price: 2.5, size: 10 });
    expect(bestAsk(res.book)).toBe(2.5);
    expect(bestAsk(cancelOrder(res.book, res.restingId!))).toBe(2.55);
  });
});

describe('random order flow', () => {
  it('is deterministic for a seed', () => {
    const run = (seed: number) => {
      const rng = mulberry32(seed);
      let book = callBook();
      for (let i = 0; i < 100; i++) book = randomEvent(book, rng).book;
      return book;
    };
    expect(run(4)).toEqual(run(4));
  });

  it('never crosses the book, never touches the reader’s orders except by trading, and stays a sensible size', () => {
    const rng = mulberry32(9);
    let book = submitLimit(callBook(), { side: 'buy', price: 2.0, size: 10 }).book;
    for (let i = 0; i < 2000; i++) {
      const ev = randomEvent(book, rng);
      book = ev.book;
      const b = bestBid(book), a = bestAsk(book);
      if (b !== null && a !== null) expect(a).toBeGreaterThan(b);
      if (ev.kind === 'cancel') expect(ev.size).toBeGreaterThan(0);
    }
    const orders = [...book.bids, ...book.asks].reduce((n, l) => n + l.orders.length, 0);
    expect(orders).toBeGreaterThan(15);
    expect(orders).toBeLessThan(120);
  });
});

// ---------------------------------------------------------------------------
// Chapter 44: matching rules and fragmented markets


const level = (youOwner = 'mm', youFirst = false): Order[] => {
  const others: Order[] = [
    { id: 1, side: 'bid', price: 2.4, size: 20, owner: 'mm' },
    { id: 2, side: 'bid', price: 2.4, size: 5, owner: 'customer' },
    { id: 3, side: 'bid', price: 2.4, size: 30, owner: 'lmm' },
    { id: 4, side: 'bid', price: 2.4, size: 40, owner: 'mm' },
  ];
  const you: Order = { id: 5, side: 'bid', price: 2.4, size: 10, owner: youOwner };
  return youFirst ? [you, ...others] : [...others, you];
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('allocation rules at one price', () => {
  it('price–time fills in arrival order', () => {
    expect(priceTime(level(), 30)).toEqual([20, 5, 5, 0, 0]);
    expect(priceTime(level('mm', true), 30)).toEqual([10, 20, 0, 0, 0]);
  });

  it('pro-rata shares by size and hands rounding leftovers out in time order', () => {
    expect(proRata(level(), 30)).toEqual([6, 2, 9, 11, 2]);
    // Arrival order barely matters: being first only moves a leftover contract.
    expect(proRata(level('mm', true), 30)[0]).toBe(3);
  });

  it('serves customers first, then shares pro rata among professionals', () => {
    expect(customerPriority(level(), 30)).toEqual([6, 5, 7, 10, 2]);
    expect(customerPriority(level('customer'), 30)).toEqual([4, 5, 5, 6, 10]);
  });

  it('gives the lead market maker its entitlement after customers', () => {
    expect(leadMarketMaker(0.4)(level(), 30)).toEqual([5, 5, 10, 8, 2]);
  });

  it('always allocates exactly the incoming size (or everything, if less is resting)', () => {
    for (const rule of [priceTime, proRata, customerPriority, leadMarketMaker(0.4)]) {
      for (const q of [1, 7, 30, 64, 105, 200]) {
        const shares = rule(level(), q);
        expect(sum(shares)).toBe(Math.min(q, 105));
        shares.forEach((s, i) => {
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(level()[i].size);
        });
      }
    }
  });
});

describe('three venues', () => {
  const venues = threeVenues();

  it('has an NBBO tighter than any single venue', () => {
    const q = nbbo(venues);
    expect(q.bid).toBe(2.45);
    expect(q.ask).toBe(2.5);
    expect(q.bidVenues).toEqual([1]);
    expect(q.askVenues).toEqual([2]);
    for (const v of venues) expect(v.book.asks[0].price - v.book.bids[0].price).toBeGreaterThan(q.ask! - q.bid! + 1e-9);
  });

  it('merges the books into a consolidated book', () => {
    const asks = consolidated(venues, 'ask');
    expect(asks[0]).toEqual({ price: 2.5, size: 5, byVenue: [0, 0, 5] });
    expect(asks[1]).toEqual({ price: 2.55, size: 35, byVenue: [15, 0, 20] });
  });

  it('routes a buy of 60 to the best prices, cheapest fee first at each price', () => {
    const r = routeOrder(venues, 'buy', 60, 'smart');
    expect(r.fills.map((f) => [venues[f.venue].name, f.price, f.size])).toEqual([
      ['C', 2.5, 5],
      ['C', 2.55, 20],
      ['A', 2.55, 15],
      ['C', 2.6, 20],
    ]);
    expect(r.avgPrice).toBeCloseTo(2.5625, 10);
    expect(r.fees).toBeCloseTo(5.25, 10);
    expect(r.netAvgPrice).toBeCloseTo(2.5625 + 5.25 / 6000, 10);
    expect(r.tradeThroughs).toBe(0);
  });

  it('trades through better prices if everything is sent to one venue', () => {
    const r = routeOrder(venues, 'buy', 60, 0);
    expect(r.avgPrice).toBeCloseTo(156.25 / 60, 10);
    expect(r.tradeThroughs).toBe(60);
    expect(r.fees).toBeCloseTo(30, 10);
  });

  it('routes a sale to the best bid first', () => {
    const r = routeOrder(venues, 'sell', 10, 'smart');
    expect(r.fills[0]).toMatchObject({ venue: 1, price: 2.45, size: 8 });
    expect(r.fills[1]).toMatchObject({ venue: 2, price: 2.4, size: 2 });
    expect(r.netAvgPrice).toBeLessThan(r.avgPrice + 1e-12);
  });
});
