import { mulberry32 } from '../math/rng';
import { cdf } from '../math/normal';
import { nelderMead } from '../math/optimize';
import { greeks, price } from '../pricing/blackScholes';
import type { OptionType } from '../pricing/payoff';
import { tickFor } from '../micro/liquidity';
import { EQUITY_SSVI, ssviVol, sviTotalVariance, type SVIParams } from '../vol/smile';

/**
 * From noisy quotes to a clean smile (Chapter 55): clean a raw chain, back out
 * the forward and discount factor from put–call parity, turn quotes into
 * implied volatilities, and fit an SVI smile weighted by how tight each quote is.
 */

export const SURFACE_MARKET = { S: 100, r: 0.05, q: 0.01, T: 0.25 };

export interface RawQuote {
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}

export interface RawRow {
  strike: number;
  call: RawQuote;
  put: RawQuote;
  /** For teaching only: which rows were deliberately spoiled. */
  stale: boolean;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** The true smile behind the synthetic chain (SSVI in log-moneyness against the true forward). */
export function trueVol(K: number): number {
  const { S, r, q, T } = SURFACE_MARKET;
  return ssviVol(Math.log(K / (S * Math.exp((r - q) * T))), T, EQUITY_SSVI);
}

function makeQuote(type: OptionType, K: number, S: number, rng: () => number): RawQuote {
  const { r, q, T } = SURFACE_MARKET;
  const input = { S, K, r, q, T, sigma: trueVol(K) };
  const theo = price(type, input);
  const g = greeks(type, input);
  const half = 0.01 + 0.4 * g.vega * 0.01 + 0.01 * Math.abs(g.delta);
  const tb = tickFor(Math.max(theo - half, 0), 'standard'), ta = tickFor(theo + half, 'standard');
  const bid = Math.max(round2(Math.floor((theo - half) / tb + 1e-9) * tb), 0);
  const ask = Math.max(round2(Math.ceil((theo + half) / ta - 1e-9) * ta), round2(bid + tickFor(bid, 'standard')));
  return { bid, ask, bidSize: 5 * (1 + Math.floor(rng() * 10)), askSize: 5 * (1 + Math.floor(rng() * 10)) };
}

/**
 * A morning screen for three-month options: quotes from a market maker on the
 * true smile, except that two strikes are stale (still quoted off yesterday's
 * close of $102) and one put quote is crossed.
 */
export function noisyChain(seed = 55, strikes: number[] = Array.from({ length: 13 }, (_, i) => 70 + 5 * i)): RawRow[] {
  const rng = mulberry32(seed);
  const stale = new Set([90, 110]);
  const yesterday = 102;
  return strikes.map((K) => {
    const S = stale.has(K) ? yesterday : SURFACE_MARKET.S;
    const row: RawRow = { strike: K, call: makeQuote('call', K, S, rng), put: makeQuote('put', K, S, rng), stale: stale.has(K) };
    if (K === 105) row.put = { ...row.put, bid: round2(row.put.ask + 0.05) };
    return row;
  });
}

export const usable = (q: RawQuote) => q.bid > 0 && q.ask > q.bid;
export const mid = (q: RawQuote) => (q.bid + q.ask) / 2;

/** Size-weighted mid (the microprice): leans towards the side with less size. */
export function microprice(q: RawQuote): number {
  return (q.ask * q.bidSize + q.bid * q.askSize) / (q.bidSize + q.askSize);
}

export interface ParityFit {
  /** Discount factor B and forward F from C − P = B(F − K). */
  B: number;
  F: number;
  /** Strikes used after dropping outliers. */
  used: number[];
  /** Residual of each strike's C − P from the fitted line. */
  residuals: Map<number, number>;
}

/**
 * Regress mid(C) − mid(P) on K across strikes: the slope is −B and the
 * intercept B·F. With `robust`, the worst-fitting strike is dropped and the
 * line refitted, again and again, while some strike misses the line by more than
 * its quotes allow (half the call's spread plus half the put's, plus a cent).
 * Stale quotes show up this way.
 */
export function parityRegression(rows: RawRow[], robust: boolean): ParityFit {
  const fit = (rs: RawRow[]) => {
    const xs = rs.map((r) => r.strike), ys = rs.map((r) => mid(r.call) - mid(r.put));
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slope = sxy / sxx, intercept = my - slope * mx;
    return { B: -slope, F: intercept / -slope };
  };
  const resid = (r: RawRow, p: { B: number; F: number }) => mid(r.call) - mid(r.put) - p.B * (p.F - r.strike);
  const tolerance = (r: RawRow) => (r.call.ask - r.call.bid) / 2 + (r.put.ask - r.put.bid) / 2 + 0.01;
  let rs = rows.filter((r) => usable(r.call) && usable(r.put));
  let f = fit(rs);
  while (robust && rs.length > 3) {
    const worst = rs.reduce((a, r) => (Math.abs(resid(r, f)) / tolerance(r) > Math.abs(resid(a, f)) / tolerance(a) ? r : a));
    if (Math.abs(resid(worst, f)) <= tolerance(worst)) break;
    rs = rs.filter((r) => r !== worst);
    f = fit(rs);
  }
  return { ...f, used: rs.map((r) => r.strike), residuals: new Map(rows.map((r) => [r.strike, resid(r, f)])) };
}

/** Black-76 price of an option on a forward F with discount factor B. */
export function black76(type: OptionType, F: number, K: number, B: number, T: number, sigma: number): number {
  const sd = sigma * Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sd * sd) / sd, d2 = d1 - sd;
  return type === 'call' ? B * (F * cdf(d1) - K * cdf(d2)) : B * (K * cdf(-d2) - F * cdf(-d1));
}

/** Implied volatility from a Black-76 price, by bisection on [0.1%, 300%]; NaN if outside the no-arbitrage range. */
export function black76ImpliedVol(type: OptionType, p: number, F: number, K: number, B: number, T: number): number {
  let lo = 0.001, hi = 3;
  const f = (s: number) => black76(type, F, K, B, T, s) - p;
  if (f(lo) > 0 || f(hi) < 0) return NaN;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}

export interface VolPoint {
  strike: number;
  type: OptionType;
  bidVol: number;
  askVol: number;
  midVol: number;
  /** Excluded by the cleaning steps chosen. */
  excluded: boolean;
  reason?: string;
}

export interface CleaningChoices {
  dropBad: boolean;
  dropStale: boolean;
  otmOnly: boolean;
  parityForward: boolean;
  weightBySpread: boolean;
}

export interface SurfaceFit {
  F: number;
  B: number;
  points: VolPoint[];
  svi: SVIParams;
  vol: (K: number) => number;
  /** Root-mean-square error of the fitted vol against the true smile over the quoted range, in vol points. */
  rmse: number;
  /** Share of fitted vols inside the included quotes' bid–ask vol band. */
  insideBand: number;
}

/** Run the whole pipeline with the chosen cleaning steps. */
export function fitSurface(rows: RawRow[], c: CleaningChoices): SurfaceFit {
  const { S, r, T } = SURFACE_MARKET;
  const par = parityRegression(rows, c.dropStale);
  const F = c.parityForward ? par.F : S * Math.exp(r * T);
  const B = c.parityForward ? par.B : Math.exp(-r * T);
  // Stale: usable on both sides, but dropped by the robust parity fit.
  const staleSet = new Set(rows.filter((row) => usable(row.call) && usable(row.put) && !par.used.includes(row.strike)).map((row) => row.strike));
  const points: VolPoint[] = [];
  for (const row of rows) {
    for (const type of ['call', 'put'] as const) {
      const q = row[type];
      let reason: string | undefined;
      if (c.dropBad && !usable(q)) reason = q.bid === 0 ? 'zero bid' : 'crossed';
      else if (c.dropStale && staleSet.has(row.strike)) reason = 'stale';
      else if (c.otmOnly && (type === 'call' ? row.strike < F : row.strike >= F)) reason = 'in the money';
      const bidVol = black76ImpliedVol(type, q.bid, F, row.strike, B, T);
      const askVol = black76ImpliedVol(type, q.ask, F, row.strike, B, T);
      const midVol = black76ImpliedVol(type, mid(q), F, row.strike, B, T);
      points.push({ strike: row.strike, type, bidVol, askVol, midVol, excluded: reason !== undefined, reason });
    }
  }
  const data = points.filter((p) => !p.excluded && Number.isFinite(p.midVol));
  const weight = (p: VolPoint) => {
    if (!c.weightBySpread) return 1;
    const lo = Number.isFinite(p.bidVol) ? p.bidVol : 0;
    const width = Math.max((Number.isFinite(p.askVol) ? p.askVol : p.midVol + 0.05) - lo, 0.002);
    return 1 / (width * width);
  };
  // SVI parameters, kept in a sensible region: 0 < b < 1, |ρ| < 1, |m| < 0.5, 0.01 < s < 1.
  const sig = (x: number) => 1 / (1 + Math.exp(-x));
  const decode = (x: number[]): SVIParams => ({ a: x[0], b: sig(x[1]), rho: Math.tanh(x[2]), m: 0.5 * Math.tanh(x[3]), s: 0.01 + 0.99 * sig(x[4]) });
  const loss = (x: number[]) => {
    const p = decode(x);
    // Total variance must stay positive: its minimum is a + b s √(1 − ρ²).
    const minW = p.a + p.b * p.s * Math.sqrt(1 - p.rho * p.rho);
    let L = minW < 0 ? 1e3 * minW * minW : 0;
    for (const d of data) {
      const w = sviTotalVariance(Math.log(d.strike / F), p);
      const vol = Math.sqrt(Math.max(w, 1e-8) / T);
      L += weight(d) * (vol - d.midVol) ** 2;
    }
    return L;
  };
  let best = { x: [0.005, -2, -0.5, 0, -2], fx: Infinity };
  for (const start of [[0.005, -2, -0.5, 0, -2], [0.002, -1, -1, 0.5, -1], [0.008, -3, 0, -0.5, -3]]) {
    const r = nelderMead(loss, start, { step: 0.3, maxIter: 4000 });
    if (r.fx < best.fx) best = r;
  }
  const svi = decode(best.x);
  const vol = (K: number) => Math.sqrt(Math.max(sviTotalVariance(Math.log(K / F), svi), 1e-8) / T);
  // Judge the fit over the quoted range: strikes whose out-of-the-money option has a bid.
  const trueF = SURFACE_MARKET.S * Math.exp((SURFACE_MARKET.r - SURFACE_MARKET.q) * T);
  const judged = rows.filter((row) => (row.strike < trueF ? row.put : row.call).bid > 0).map((row) => row.strike);
  const rmse = Math.sqrt(judged.reduce((a, K) => a + (vol(K) - trueVol(K)) ** 2, 0) / judged.length) * 100;
  const band = data.filter((d) => Number.isFinite(d.bidVol) && Number.isFinite(d.askVol));
  const insideBand = band.filter((d) => vol(d.strike) >= d.bidVol - 1e-4 && vol(d.strike) <= d.askVol + 1e-4).length / Math.max(band.length, 1);
  return { F, B, points, svi, vol, rmse, insideBand };
}
