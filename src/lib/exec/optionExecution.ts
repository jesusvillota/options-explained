import { quoteOption } from '../micro/liquidity';
import { lelandVol } from '../mm/transactionCosts';

/**
 * Executing option trades (Chapter 65). A volatility trader buys a vega
 * notional Q (dollars per vol point) in three-month options. Costs are
 * measured in vol points: dollars divided by the vega bought. The model is
 * stylised: half-spreads come from Chapter 47's quotes on a skewed smile,
 * impact follows a square-root law in vol points, and a dealer answering a
 * request for quote charges for warehousing the risk (Chapter 60).
 */

/** Stock-tied price: the option limit V moves with the stock by its delta. */
export const tiedPrice = (V: number, delta: number, S: number, Sref: number) => V + delta * (S - Sref);

export const VOL_T = 0.25;
export const VOL_STRIKES = [90, 95, 100, 105, 110];

export interface StrikeRow {
  strike: number;
  type: 'call' | 'put';
  vol: number;
  /** Vega per share per vol point. */
  vegaPt: number;
  /** Half the quoted spread, in vol points. */
  halfSpreadVol: number;
  /** Typical daily traded vega at this strike, dollars per vol point. */
  dailyVega: number;
}

/** ATM daily traded vega and how quickly it falls with moneyness. */
export const LIQUIDITY = { atm: 400000, width: 0.1 };

export function strikeRows(strikes: number[] = VOL_STRIKES, T = VOL_T): StrikeRow[] {
  return strikes.map((K) => {
    const q = quoteOption(K < 100 ? 'put' : 'call', K, T);
    return {
      strike: K,
      type: q.type,
      vol: q.vol,
      vegaPt: q.vegaPt,
      halfSpreadVol: (q.ask - q.bid) / 2 / q.vegaPt,
      dailyVega: LIQUIDITY.atm * Math.exp(-((Math.log(K / 100) / LIQUIDITY.width) ** 2)),
    };
  });
}

export interface ImpactParams {
  /** Square-root-law prefactor. */
  Y: number;
  /** Daily volatility of implied volatility, vol points. */
  volOfVol: number;
}
export const OPTION_IMPACT: ImpactParams = { Y: 0.7, volOfVol: 1 };

/** Impact in vol points of buying vega Q at a strike: Y σ_vol √(Q / daily vega). */
export const impactVol = (Q: number, row: StrikeRow, p: ImpactParams = OPTION_IMPACT) => p.Y * p.volOfVol * Math.sqrt(Math.max(Q, 0) / row.dailyVega);

export type Allocation = 'atm' | 'even' | 'liquidity';

/**
 * Split vega Q across strikes: all at the money, evenly, or in proportion to
 * each strike's daily traded vega. With square-root impact the last one
 * minimises total impact, Σ Q_i a√(Q_i/L_i), because it equalises Q_i/L_i.
 */
export function allocate(Q: number, rows: StrikeRow[], mode: Allocation): number[] {
  if (mode === 'atm') return rows.map((r) => (r.strike === 100 ? Q : 0));
  if (mode === 'even') return rows.map(() => Q / rows.length);
  const L = rows.reduce((a, r) => a + r.dailyVega, 0);
  return rows.map((r) => (Q * r.dailyVega) / L);
}

/**
 * Expected share of the half-spread paid when working an order: start at the
 * mid and step towards the far side every interval. At a fraction θ of the
 * half-spread, the chance of a fill in the interval is p₀ + (1 − p₀)θ².
 */
export function ladderFraction(steps = 5, p0 = 0.15): { fraction: number; expectedSteps: number } {
  let alive = 1, fraction = 0, expectedSteps = 0;
  for (let k = 0; k < steps; k++) {
    const theta = steps === 1 ? 1 : k / (steps - 1);
    const p = k === steps - 1 ? 1 : p0 + (1 - p0) * theta ** 2;
    fraction += alive * p * theta;
    expectedSteps += alive * p * (k + 1);
    alive *= 1 - p;
  }
  return { fraction, expectedSteps };
}

export type Method = 'screen' | 'work' | 'rfq';

/** A dealer's warehousing charge in a request for quote: vol points per $1,000 of vega. */
export const RFQ_CHARGE = 0.004;

export interface LegCost {
  strike: number;
  vega: number;
  /** Cost components in vol points. */
  spread: number;
  impact: number;
  /** Dollars: vega × (spread + impact). */
  dollars: number;
}

/** Entry cost of buying the allocated vega, leg by leg. */
export function entryCost(alloc: number[], rows: StrikeRow[], method: Method, p: ImpactParams = OPTION_IMPACT): LegCost[] {
  const Q = alloc.reduce((a, b) => a + b, 0);
  const work = ladderFraction().fraction;
  return rows.map((r, i) => {
    const vega = alloc[i];
    let spread = r.halfSpreadVol, impact = impactVol(vega, r, p);
    if (method === 'work') spread *= work;
    if (method === 'rfq') {
      // The dealer quotes the package at the mid plus half the half-spread and a warehousing charge on the total size.
      spread = 0.5 * r.halfSpreadVol;
      impact = (RFQ_CHARGE * Q) / 1000;
    }
    return { strike: r.strike, vega, spread, impact, dollars: vega * (spread + impact) };
  });
}

/**
 * Vol points lost to delta hedging a long option with proportional stock cost
 * ε, rebalancing every δt: a long hedger realises σ√(1 − Le) instead of σ.
 */
export function hedgingDragVol(sigma: number, eps: number, dt: number): number {
  return (sigma - lelandVol(sigma, eps, dt, false)) * 100;
}

export interface VolTradePlan {
  legs: LegCost[];
  /** Entry cost in dollars and in vol points (dollars / vega). */
  entryDollars: number;
  entryVol: number;
  /** Round trip: entry plus an exit of the same cost. */
  roundTripVol: number;
  hedgeVol: number;
  /** Realised-minus-implied volatility needed to break even, vol points. */
  breakevenVol: number;
  /** Expected profit for a given edge (vol points), in dollars. */
  expectedPnl: number;
}

export function volTradePlan(o: { Q: number; allocation: Allocation; method: Method; edge: number; stockCost?: number }): VolTradePlan {
  const rows = strikeRows();
  const alloc = allocate(o.Q, rows, o.allocation);
  const legs = entryCost(alloc, rows, o.method);
  const entryDollars = legs.reduce((a, l) => a + l.dollars, 0);
  const entryVol = entryDollars / o.Q;
  const roundTripVol = 2 * entryVol;
  const hedgeVol = hedgingDragVol(0.2, o.stockCost ?? 0.0002, 1 / 252);
  const breakevenVol = roundTripVol + hedgeVol;
  return { legs, entryDollars, entryVol, roundTripVol, hedgeVol, breakevenVol, expectedPnl: (o.edge - breakevenVol) * o.Q };
}
