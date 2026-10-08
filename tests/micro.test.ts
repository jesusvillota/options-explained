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
import { STRATEGIES, complexQuote, impliedFromLegs, leggingRiskSd, quoteLegs } from '../src/lib/micro/packages';
import { MARGIN_POSITIONS, assignmentOdds, nakedRequirementPerShare, positionValue, riskArray, scaledGrid, scenarioMargin, strategyMargin } from '../src/lib/micro/margin';
import { clearAuction, demandAt, openingOrders, priceGrid, supplyAt, type AuctionOrder } from '../src/lib/micro/auction';

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

// ---------------------------------------------------------------------------
// Chapter 45: complex orders and auctions

describe('packages', () => {
  it('builds a bull call spread market of 1.95 / 2.40 from the legs', () => {
    const m = impliedFromLegs(quoteLegs(STRATEGIES.bullCall.legs));
    expect(m.bid).toBeCloseTo(1.95, 10);
    expect(m.ask).toBeCloseTo(2.4, 10);
    expect(m.theo).toBeCloseTo(4.615 - 2.478, 2);
  });

  it('quotes the spread itself much tighter, because its legs offset', () => {
    const c = complexQuote(quoteLegs(STRATEGIES.bullCall.legs));
    expect(c.bid).toBe(2.11);
    expect(c.ask).toBe(2.17);
    const fly = complexQuote(quoteLegs(STRATEGIES.butterfly.legs));
    expect([fly.bid, fly.ask]).toEqual([0.9, 1.02]);
    expect(impliedFromLegs(quoteLegs(STRATEGIES.butterfly.legs)).ask - impliedFromLegs(quoteLegs(STRATEGIES.butterfly.legs)).bid).toBeCloseTo(1.15, 10);
  });

  it('never quotes a package worse than its legs, and always brackets theo', () => {
    for (const s of Object.values(STRATEGIES)) {
      const legs = quoteLegs(s.legs);
      const m = impliedFromLegs(legs), c = complexQuote(legs);
      expect(c.bid).toBeGreaterThanOrEqual(m.bid - 1e-9);
      expect(c.ask).toBeLessThanOrEqual(m.ask + 1e-9);
      expect(c.bid).toBeLessThan(c.theo);
      expect(c.ask).toBeGreaterThan(c.theo);
    }
    // A long strangle's legs add up rather than offset: no discount at all.
    const strangle = quoteLegs(STRATEGIES.strangle.legs);
    expect([complexQuote(strangle).bid, complexQuote(strangle).ask]).toEqual([3.85, 4.15]);
  });

  it('has legging risk growing like the square root of the delay', () => {
    const legs = quoteLegs(STRATEGIES.bullCall.legs);
    expect(leggingRiskSd(legs, 4)).toBeCloseTo(2 * leggingRiskSd(legs, 1), 12);
    // After buying the 100 call, the short 105 call's delta (−0.377) is exposed: 0.377 × 0.2 × 100 × √(1/98280).
    expect(leggingRiskSd(legs, 1)).toBeCloseTo(0.3772 * 20 * Math.sqrt(1 / 98280), 4);
  });
});

describe('call auction', () => {
  const orders = openingOrders();
  const grid = priceGrid(2.2, 2.8, 0.05);

  it('has demand falling and supply rising with price', () => {
    for (let i = 1; i < grid.length; i++) {
      expect(demandAt(orders, grid[i])).toBeLessThanOrEqual(demandAt(orders, grid[i - 1]));
      expect(supplyAt(orders, grid[i])).toBeGreaterThanOrEqual(supplyAt(orders, grid[i - 1]));
    }
  });

  it('clears the opening at 2.45 for 125 contracts', () => {
    const r = clearAuction(orders, grid, 2.48);
    expect(r.price).toBe(2.45);
    expect(r.volume).toBe(125);
    expect(r.imbalance).toBe(-5);
    for (const p of grid) expect(Math.min(demandAt(orders, p), supplyAt(orders, p))).toBeLessThanOrEqual(125);
  });

  it('fills the same number of contracts on each side, best limits and market orders first', () => {
    const r = clearAuction(orders, grid, 2.48);
    const total = (side: 'buy' | 'sell') => orders.filter((o) => o.side === side).reduce((a, o) => a + (r.fills.get(o.id) ?? 0), 0);
    expect(total('buy')).toBe(125);
    expect(total('sell')).toBe(125);
    for (const o of orders) {
      const f = r.fills.get(o.id) ?? 0;
      if (o.limit === null) expect(f).toBe(o.size);
      if (o.side === 'buy' && o.limit !== null && o.limit > 2.45 + 1e-9) expect(f).toBe(o.size);
      if (o.side === 'buy' && o.limit !== null && o.limit < 2.45 - 1e-9) expect(f).toBe(0);
    }
  });

  it('breaks ties by imbalance, then by closeness to the reference price', () => {
    const two: AuctionOrder[] = [
      { id: 1, side: 'buy', limit: 2.5, size: 10, owner: 'x' },
      { id: 2, side: 'sell', limit: 2.4, size: 10, owner: 'x' },
    ];
    expect(clearAuction(two, priceGrid(2.3, 2.6, 0.05), 2.48).price).toBe(2.5);
    expect(clearAuction(two, priceGrid(2.3, 2.6, 0.05), 2.41).price).toBe(2.4);
    expect(clearAuction([two[0]], priceGrid(2.3, 2.6, 0.05), 2.48).price).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chapter 46: margin and assignment

describe('margin', () => {
  const calm = { S: 100, T: 0.25, r: 0.05, sigma: 0.2, q: 0 };
  const put95 = MARGIN_POSITIONS.shortPut.legs;

  it('applies the classic naked-option rule: premium + max(20% S − OTM, floor)', () => {
    const premium = price('put', { ...calm, K: 95 });
    // 20% of 100 less 5 out of the money = 15, above the 10%-of-strike floor of 9.50.
    expect(nakedRequirementPerShare(put95[0], calm)).toBeCloseTo(premium + 15, 10);
    // Far out of the money the floor binds: 20% × 100 − 30 < 10% × 70.
    expect(nakedRequirementPerShare({ type: 'put', strike: 70, qty: -1 }, calm)).toBeCloseTo(price('put', { ...calm, K: 70 }) + 7, 10);
    expect(strategyMargin(put95, calm)).toBeCloseTo(100 * (premium + 15), 8);
  });

  it('charges a credit spread its maximum loss, and long positions nothing', () => {
    expect(strategyMargin(MARGIN_POSITIONS.putSpread.legs, calm)).toBe(500);
    expect(strategyMargin([{ type: 'call', strike: 100, qty: 1 }], calm)).toBe(0);
    expect(strategyMargin([{ type: 'call', strike: 100, qty: 1 }, { type: 'call', strike: 105, qty: -1 }], calm)).toBe(0);
  });

  it('charges a short straddle the larger naked requirement plus the other premium', () => {
    const legs = MARGIN_POSITIONS.shortStraddle.legs;
    const call = nakedRequirementPerShare(legs[1], calm), put = nakedRequirementPerShare(legs[0], calm);
    const expected = 100 * (Math.max(call, put) + (call >= put ? price('put', { ...calm, K: 100 }) : price('call', { ...calm, K: 100 })));
    expect(strategyMargin(legs, calm)).toBeCloseTo(expected, 8);
  });

  it('scales the scenario grid with volatility: ±2.33σ√(10/252) and ±σ/3', () => {
    const g = scaledGrid(0.2);
    expect(g.priceShocks[10]).toBeCloseTo(2.33 * 0.2 * Math.sqrt(10 / 252), 12);
    expect(g.priceShocks[5]).toBeCloseTo(0, 12);
    expect(g.volShocks[4]).toBeCloseTo(0.2 / 3, 12);
  });

  it('finds the short put’s worst case at a fall in the stock with a rise in volatility', () => {
    const r = scenarioMargin(put95, calm);
    expect(r.worst.priceShock).toBeLessThan(0);
    expect(r.worst.volShock).toBeGreaterThan(0);
    expect(r.margin).toBeCloseTo(-r.worst.pnl, 12);
    expect(riskArray(put95, calm, scaledGrid(0.2))[2][5]).toBeCloseTo(0, 10);
    // Risk-based margin is far below the rule-based one for a naked put.
    expect(r.margin).toBeLessThan(0.4 * strategyMargin(put95, calm));
  });

  it('is procyclical: more volatility, more margin', () => {
    let prev = 0;
    for (const sigma of [0.1, 0.2, 0.3, 0.4, 0.5]) {
      const m = scenarioMargin(put95, { ...calm, sigma }).margin;
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
    expect(scenarioMargin(put95, { ...calm, sigma: 0.35, S: 97 }).margin).toBeGreaterThan(2 * scenarioMargin(put95, calm).margin);
  });

  it('rewards hedging: a put spread needs much less margin than a naked put', () => {
    expect(scenarioMargin(MARGIN_POSITIONS.putSpread.legs, calm).margin).toBeLessThan(0.5 * scenarioMargin(put95, calm).margin);
    expect(positionValue(MARGIN_POSITIONS.putSpread.legs, calm)).toBeLessThan(0);
  });
});

describe('random assignment', () => {
  it('assigns on average in proportion to your share of the open short position', () => {
    expect(assignmentOdds(1000, 10, 100).expected).toBeCloseTo(1, 12);
    // P(none of 10 out of 1000 among 100 random draws) = C(990,100)/C(1000,100) ≈ 0.347.
    expect(assignmentOdds(1000, 10, 100).pNone).toBeCloseTo(0.3469, 4);
    expect(assignmentOdds(50, 10, 45).pNone).toBe(0);
    expect(assignmentOdds(50, 10, 0).pNone).toBe(1);
  });
});
