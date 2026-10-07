/**
 * Shape constraints on call prices across strikes (Chapter 10). For strikes
 * K1 < K2 < K3 and a common expiry T, no arbitrage requires
 *   decreasing:   C(K1) ≥ C(K2)
 *   not too steep: C(K1) − C(K2) ≤ (K2 − K1) e^{−rT}
 *   convex:       λ C(K1) − C(K2) + (1 − λ) C(K3) ≥ 0,  λ = (K3 − K2)/(K3 − K1)
 */
export interface StrikeQuote {
  K: number;
  C: number;
}

export interface ShapeViolation {
  kind: 'increasing' | 'too-steep' | 'not-convex';
  strikes: number[];
  /** Riskless profit locked in today, per share. */
  profitToday: number;
  trade: string;
}

export function shapeViolations(quotes: StrikeQuote[], r: number, T: number, tolerance = 1e-9): ShapeViolation[] {
  const q = [...quotes].sort((a, b) => a.K - b.K);
  const out: ShapeViolation[] = [];
  const df = Math.exp(-r * T);
  for (let i = 0; i + 1 < q.length; i++) {
    const [a, b] = [q[i], q[i + 1]];
    if (b.C - a.C > tolerance) {
      out.push({
        kind: 'increasing',
        strikes: [a.K, b.K],
        profitToday: b.C - a.C,
        trade: `Buy the ${a.K} call and sell the ${b.K} call (a bull spread you are paid to own). Its payoff is never negative.`,
      });
    }
    const maxSpread = (b.K - a.K) * df;
    if (a.C - b.C - maxSpread > tolerance) {
      out.push({
        kind: 'too-steep',
        strikes: [a.K, b.K],
        profitToday: a.C - b.C - maxSpread,
        trade: `Sell the ${a.K} call, buy the ${b.K} call and lend ${maxSpread.toFixed(2)}: the spread can never cost you more than ${b.K - a.K} at expiry.`,
      });
    }
  }
  for (let i = 0; i + 2 < q.length; i++) {
    const [a, b, c] = [q[i], q[i + 1], q[i + 2]];
    const lambda = (c.K - b.K) / (c.K - a.K);
    const fly = lambda * a.C - b.C + (1 - lambda) * c.C;
    if (fly < -tolerance) {
      out.push({
        kind: 'not-convex',
        strikes: [a.K, b.K, c.K],
        profitToday: -fly,
        trade: `Buy the ${a.K}/${b.K}/${c.K} butterfly: you are paid to own a payoff that can never be negative.`,
      });
    }
  }
  return out;
}

/**
 * The risk-neutral probability of ending near each interior strike, read off
 * butterflies: e^{rT} × butterfly price / ΔK (equally spaced strikes). Each is the
 * probability mass of S_T in a band of width ΔK around K (Breeden–Litzenberger, Chapter 27).
 */
export function butterflyProbabilities(quotes: StrikeQuote[], r: number, T: number): { K: number; p: number }[] {
  const q = [...quotes].sort((a, b) => a.K - b.K);
  const out: { K: number; p: number }[] = [];
  for (let i = 1; i + 1 < q.length; i++) {
    const dK = q[i + 1].K - q[i].K;
    const fly = q[i - 1].C - 2 * q[i].C + q[i + 1].C;
    out.push({ K: q[i].K, p: (Math.exp(r * T) * fly) / dK });
  }
  return out;
}
