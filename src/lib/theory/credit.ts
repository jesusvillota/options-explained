import { cdf } from '../math/normal';
import { price } from '../pricing/blackScholes';
import { nelderMead } from '../math/optimize';

/**
 * Merton's (1974) structural credit model (Chapter 42). A firm's assets A
 * follow GBM with volatility σ_A; it owes D, all due at T. At T the
 * shareholders pay the debt if they can, so equity is a call on the assets
 * struck at D, and debt is a riskless bond minus a put.
 */
export interface MertonFirm {
  A: number;
  D: number;
  T: number;
  r: number;
  sigmaA: number;
}

export function mertonFirm({ A, D, T, r, sigmaA }: MertonFirm) {
  const input = { S: A, K: D, T, r, sigma: sigmaA };
  const equity = price('call', input);
  const debt = A - equity; // = D e^{−rT} − put
  const sq = sigmaA * Math.sqrt(T);
  const d1 = (Math.log(A / D) + (r + 0.5 * sigmaA * sigmaA) * T) / sq;
  const d2 = d1 - sq;
  const yieldOnDebt = -Math.log(debt / D) / T;
  return {
    equity,
    debt,
    /** Risk-neutral probability of default: Q(A_T < D) = N(−d₂). */
    defaultProbability: cdf(-d2),
    /** Credit spread: the debt's yield above the risk-free rate. */
    spread: yieldOnDebt - r,
    /** Equity volatility σ_E = (A/E)·N(d₁)·σ_A: leverage amplifies asset volatility. */
    equityVol: (A / equity) * cdf(d1) * sigmaA,
    /** Distance to default: how many standard deviations the assets are above the debt (risk-neutral drift). */
    distanceToDefault: d2,
  };
}

/**
 * Back out the unobservable asset value and volatility from the observable
 * equity value and equity volatility (the KMV approach): two equations,
 * E = C(A, σ_A) and σ_E = (A/E)N(d₁)σ_A, solved by least squares.
 */
export function calibrateMerton(E: number, sigmaE: number, D: number, T: number, r: number): { A: number; sigmaA: number } {
  const loss = ([logA, logS]: number[]) => {
    const f = mertonFirm({ A: Math.exp(logA), D, T, r, sigmaA: Math.exp(logS) });
    return ((f.equity - E) / E) ** 2 + ((f.equityVol - sigmaE) / sigmaE) ** 2;
  };
  const A0 = E + D * Math.exp(-r * T);
  const { x } = nelderMead(loss, [Math.log(A0), Math.log((sigmaE * E) / A0)], { tol: 1e-16, maxIter: 4000 });
  return { A: Math.exp(x[0]), sigmaA: Math.exp(x[1]) };
}
