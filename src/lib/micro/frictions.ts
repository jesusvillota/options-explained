import { optionChain, type ChainRow } from '../market/optionChain';
import { DEFAULTS } from '../pricing/blackScholes';

/**
 * No-arbitrage with frictions (Chapter 48): put–call parity as a band rather
 * than a line, the borrow cost it implies, and box spreads as interest rates.
 */

export interface Frictions {
  /** Stock bid and ask. */
  stockBid: number;
  stockAsk: number;
  /** Continuously compounded rates at which you can lend and borrow cash. */
  rLend: number;
  rBorrow: number;
  /** Annual fee for borrowing the stock to short it, as a continuous yield. */
  borrowFee: number;
  T: number;
}

export interface Band {
  lower: number;
  upper: number;
}

/**
 * The range of C − P (same strike K and expiry T) that admits no arbitrage:
 *  - conversion (buy stock at the ask, sell the call, buy the put, borrow the
 *    cost) is unprofitable iff b_C − a_P ≤ S^a − K e^{−r_b T};
 *  - reversal (short the stock at the bid, paying the borrow fee, buy the call,
 *    sell the put, lend the proceeds) is unprofitable iff
 *    a_C − b_P ≥ S^b e^{−f T} − K e^{−r_ℓ T}.
 */
export function parityBand(K: number, f: Frictions): Band {
  return {
    lower: f.stockBid * Math.exp(-f.borrowFee * f.T) - K * Math.exp(-f.rLend * f.T),
    upper: f.stockAsk - K * Math.exp(-f.rBorrow * f.T),
  };
}

/** The market for the synthetic C − P: sell the call and buy the put, or the reverse. */
export function syntheticMarket(row: ChainRow): { bid: number; ask: number } {
  return { bid: row.call.bid - row.put.ask, ask: row.call.ask - row.put.bid };
}

export interface ParityArbitrage {
  kind: 'conversion' | 'reversal' | null;
  /** Riskless profit per share, received at expiry. */
  profit: number;
}

/** Check one strike's quotes against the band, and price the arbitrage if there is one. */
export function parityArbitrage(row: ChainRow, f: Frictions): ParityArbitrage {
  const K = row.strike;
  const m = syntheticMarket(row);
  const band = parityBand(K, f);
  if (m.bid > band.upper + 1e-12) {
    // Conversion: pay S^a − b_C + a_P now (borrowed), deliver the stock for K at expiry.
    return { kind: 'conversion', profit: K - (f.stockAsk - row.call.bid + row.put.ask) * Math.exp(f.rBorrow * f.T) };
  }
  if (m.ask < band.lower - 1e-12) {
    // Reversal: receive S^b e^{−fT} − a_C + b_P now (lent), buy the stock back for K at expiry.
    return { kind: 'reversal', profit: (f.stockBid * Math.exp(-f.borrowFee * f.T) - row.call.ask + row.put.bid) * Math.exp(f.rLend * f.T) - K };
  }
  return { kind: null, profit: 0 };
}

/**
 * The borrow cost (or dividend yield) implied by mid prices, read off parity
 * C − P = S e^{−qT} − K e^{−rT}:  q = −(1/T) ln[(C − P + K e^{−rT}) / S].
 */
export function impliedBorrow(callMid: number, putMid: number, S: number, K: number, T: number, r: number): number {
  return -Math.log((callMid - putMid + K * Math.exp(-r * T)) / S) / T;
}

/** A chain priced as if the stock carried a borrow fee (it acts like a dividend yield). */
export function chainWithBorrowFee(T: number, strikes: number[], fee: number): ChainRow[] {
  return optionChain({ ...DEFAULTS, T, q: fee, strikes, seed: 7 });
}

/** The continuously compounded rate implied by a box costing `price` today and paying `width` at T. */
export function boxRate(price: number, width: number, T: number): number {
  return -Math.log(price / width) / T;
}
