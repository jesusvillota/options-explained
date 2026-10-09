import { mulberry32, normalRng } from '../math/rng';
import { greeks, price } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';

/**
 * Quoting around a theoretical value (Chapter 56).
 *
 * A market maker quotes theo ± edge, with the edge set in volatility points:
 * bid = V − e_σ·𝒱, ask = V + e_σ·𝒱 (to first order). Routine updates come every
 * `latency` seconds; in between, quotes either stand still or slide with the
 * stock by delta ("tied" quotes). When news hits, the market maker and the
 * fastest sniper race: if the sniper is faster, it picks off the stale quote.
 */

/** Bid and ask from a volatility edge, priced exactly at σ ∓ e_σ. */
export function volEdgeQuotes(type: OptionType, input: { S: number; K: number; T: number; r: number; sigma: number }, edgeVolPts: number): { bid: number; ask: number; theo: number } {
  const e = edgeVolPts / 100;
  return {
    bid: price(type, { ...input, sigma: Math.max(input.sigma - e, 0.001) }),
    ask: price(type, { ...input, sigma: input.sigma + e }),
    theo: price(type, input),
  };
}

export interface QuotingParams {
  /** Seconds simulated. */
  seconds: number;
  /** Seconds between routine quote updates. */
  latency: number;
  /** Milliseconds the market maker takes to react to news. */
  reaction: number;
  /** Mean reaction time of the fastest sniper, in milliseconds (exponentially distributed). */
  sniperSpeed: number;
  /** Half-spread in volatility points. */
  edgeVol: number;
  /** Slide quotes with the stock by delta between updates. */
  tied: boolean;
  /** Chance per second of news: the stock jumps by ±jumpSize dollars and implied volatility by ±volJump. */
  jumpRate: number;
  jumpSize: number;
  volJump: number;
  /** Chance per second that an ordinary customer arrives. */
  customerRate: number;
  /** Customers trade only if the half-spread, in vol points, is below their tolerance (exponential with this mean). */
  customerTolerance: number;
  seed: number;
}

export const QUOTING_OPTION = { S: 100, K: 100, T: 1 / 12, r: 0.05, sigma: 0.2 };
/** Trading seconds in a year (252 days × 6.5 hours). */
const SECONDS_PER_YEAR = 252 * 23400;

export interface QuotingTrade {
  t: number;
  side: 1 | -1;
  price: number;
  sniper: boolean;
}

export interface QuotingResult {
  /** Customer trades: count and edge earned against theo, per share. */
  customerTrades: number;
  customerEdge: number;
  /** Pick-offs: count and loss against theo, per share (positive = money lost). */
  sniperTrades: number;
  sniperLoss: number;
  /** First `keep` seconds of the path, for plotting. */
  t: number[];
  theo: number[];
  bid: number[];
  ask: number[];
  trades: QuotingTrade[];
}


/**
 * One option, quoted for `seconds` seconds. Each second: the stock moves (and
 * sometimes jumps); snipers hit any quote that is now through theo by more than
 * a cent; a customer may arrive and trade at our quote; and if an update is due,
 * the quotes are recomputed. Trades are marked at the current theo and assumed
 * delta-hedged, so the P&L splits into edge earned and edge lost.
 */
export function simulateQuoting(p: QuotingParams, keep = 600): QuotingResult {
  // Separate random streams for the market, the customers and the races, so that changing the
  // quoting strategy doesn't change the market path.
  const z = normalRng(p.seed), news = mulberry32(p.seed + 1), cust = mulberry32(p.seed + 2), race = mulberry32(p.seed + 3);
  const o = QUOTING_OPTION;
  const sdStep = o.sigma * o.S * Math.sqrt(1 / SECONDS_PER_YEAR);
  let S = o.S, sigma = o.sigma, ref = { S, theo: 0, delta: 0, half: 0 }, last = -Infinity;
  // Each side shows one clip; once it's been hit, it stays down until the next update.
  let bidLive = true, askLive = true;
  const refresh = (t: number) => {
    bidLive = askLive = true;
    const g = greeks('call', { ...o, S, sigma });
    ref = { S, theo: price('call', { ...o, S, sigma }), delta: g.delta, half: (p.edgeVol / 100) * g.vega };
    last = t;
  };
  refresh(0);
  const out: QuotingResult = { customerTrades: 0, customerEdge: 0, sniperTrades: 0, sniperLoss: 0, t: [], theo: [], bid: [], ask: [], trades: [] };
  for (let t = 1; t <= p.seconds; t++) {
    S += sdStep * z();
    // Volatility shocks fade back towards 20% with a half-life of ten minutes.
    sigma = o.sigma + (sigma - o.sigma) * Math.pow(0.5, 1 / 600);
    if (news() < p.jumpRate) {
      S += (news() < 0.5 ? -1 : 1) * p.jumpSize;
      sigma += (news() < 0.5 ? -1 : 1) * p.volJump;
      // The race: the market maker re-quotes first if the sniper is slower than its reaction time.
      if (-Math.log(1 - race()) * p.sniperSpeed > p.reaction) refresh(t);
    }
    const theo = price('call', { ...o, S, sigma });
    const centre = ref.theo + (p.tied ? ref.delta * (S - ref.S) : 0);
    const bid = centre - ref.half, ask = centre + ref.half;
    if (askLive && theo - ask > 0.01) {
      out.sniperTrades++;
      out.sniperLoss += theo - ask;
      askLive = false;
      if (t <= keep) out.trades.push({ t, side: 1, price: ask, sniper: true });
    } else if (bidLive && bid - theo > 0.01) {
      out.sniperTrades++;
      out.sniperLoss += bid - theo;
      bidLive = false;
      if (t <= keep) out.trades.push({ t, side: -1, price: bid, sniper: true });
    }
    const arrives = cust() < p.customerRate, tolerance = -Math.log(1 - cust()) * p.customerTolerance;
    const side: 1 | -1 = cust() < 0.5 ? 1 : -1;
    if (arrives && tolerance > p.edgeVol) {
      if (side === 1 ? askLive : bidLive) {
        out.customerTrades++;
        out.customerEdge += side === 1 ? ask - theo : theo - bid;
        if (t <= keep) out.trades.push({ t, side, price: side === 1 ? ask : bid, sniper: false });
      }
    }
    if (t <= keep) {
      out.t.push(t);
      out.theo.push(theo);
      out.bid.push(bid);
      out.ask.push(ask);
    }
    if (t - last >= Math.max(p.latency, 1)) refresh(t);
  }
  return out;
}
