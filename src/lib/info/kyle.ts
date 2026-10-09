import { normalRng } from '../math/rng';

/**
 * Kyle's (1985) model of informed trading (Chapters 51–52).
 *
 * One period: the value is v ~ N(p0, Σ0). An insider who knows v sends an order
 * x; noise traders send u ~ N(0, σ_u²); a competitive market maker sees only the
 * total order flow y = x + u and sets p = E[v | y]. In the linear equilibrium
 *   x = β (v − p0),   p = p0 + λ y,
 * with β = σ_u/√Σ0 and λ = √Σ0/(2σ_u).
 */

/** The insider's best response to a linear pricing rule with slope λ: β = 1/(2λ). */
export function insiderBestResponse(lambda: number): number {
  return 1 / (2 * lambda);
}

/** The market maker's zero-profit slope given the insider's β: λ = βΣ0/(β²Σ0 + σ_u²). */
export function makerBestResponse(beta: number, sigma0Sq: number, sigmaU: number): number {
  return (beta * sigma0Sq) / (beta * beta * sigma0Sq + sigmaU * sigmaU);
}

export interface KyleEquilibrium {
  lambda: number;
  beta: number;
  /** Var(v | y): what the market still doesn't know after the trade. */
  posteriorVar: number;
  /** Insider's expected profit, σ_u√Σ0/2 (per unit of the asset). */
  insiderProfit: number;
  /** Noise traders' expected loss, λσ_u². */
  noiseLoss: number;
}

export function kyleEquilibrium(sigma0Sq: number, sigmaU: number): KyleEquilibrium {
  const s0 = Math.sqrt(sigma0Sq);
  const lambda = s0 / (2 * sigmaU);
  const beta = sigmaU / s0;
  return { lambda, beta, posteriorVar: sigma0Sq / 2, insiderProfit: (sigmaU * s0) / 2, noiseLoss: lambda * sigmaU * sigmaU };
}

/**
 * Iterate best responses from a starting λ: β = 1/(2λ), then λ = maker(β), …
 * Returns the sequence of (β, λ) pairs, starting with (β(λ₀), λ₀).
 */
export function bestResponsePath(lambda0: number, sigma0Sq: number, sigmaU: number, steps: number): { beta: number; lambda: number }[] {
  const out: { beta: number; lambda: number }[] = [];
  let lambda = lambda0;
  for (let i = 0; i <= steps; i++) {
    const beta = insiderBestResponse(lambda);
    out.push({ beta, lambda });
    lambda = makerBestResponse(beta, sigma0Sq, sigmaU);
  }
  return out;
}

/** The insider's expected profit, given v − p0 = d, from trading x against slope λ: d·x − λx². */
export function insiderProfit(d: number, x: number, lambda: number): number {
  return d * x - lambda * x * x;
}

export interface KyleDraw {
  v: number;
  x: number;
  u: number;
  y: number;
  p: number;
}

/** Simulate n independent one-period markets in equilibrium. */
export function simulateKyle(p0: number, sigma0Sq: number, sigmaU: number, n: number, seed: number): KyleDraw[] {
  const z = normalRng(seed);
  const { lambda, beta } = kyleEquilibrium(sigma0Sq, sigmaU);
  const out: KyleDraw[] = [];
  for (let i = 0; i < n; i++) {
    const v = p0 + Math.sqrt(sigma0Sq) * z();
    const u = sigmaU * z();
    const x = beta * (v - p0);
    const y = x + u;
    out.push({ v, x, u, y, p: p0 + lambda * y });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Continuous time (Chapter 52): Kyle (1985) in the limit, Back (1992).

export interface KyleContinuousEq {
  /** Constant price impact: λ = √Σ0 / (σ_u √T). */
  lambda: number;
  /** Volatility of the price in the market maker's eyes: λσ_u = √(Σ0/T). */
  priceVol: number;
  /** Insider's expected profit over [0, T]: σ_u √(Σ0 T), twice the one-shot profit when T = 1. */
  insiderProfit: number;
}

export function kyleContinuous(sigma0Sq: number, sigmaU: number, T: number): KyleContinuousEq {
  const lambda = Math.sqrt(sigma0Sq) / (sigmaU * Math.sqrt(T));
  return { lambda, priceVol: lambda * sigmaU, insiderProfit: sigmaU * Math.sqrt(sigma0Sq * T) };
}

/** What the market maker still doesn't know at time t: Σ_t = Σ0 (1 − t/T). */
export function posteriorVariance(sigma0Sq: number, t: number, T: number): number {
  return sigma0Sq * Math.max(1 - t / T, 0);
}

export interface KyleContinuousPath {
  t: number[];
  /** Price p_t = p0 + λ Y_t. */
  p: number[];
  /** Insider's cumulative order X_t. */
  X: number[];
  /** Noise traders' cumulative order Z_t. */
  Z: number[];
  /** Insider's cumulative profit ∫ (v − p) dX, per unit. */
  profit: number[];
}

/**
 * Euler simulation of the equilibrium on n steps. The insider trades at rate
 * θ_t = (v − p_t) / (λ (T − t)); noise traders' order flow is σ_u dW. With the
 * insider switched off, the market maker still prices order flow with the same λ.
 */
export function simulateKyleContinuous(o: { p0: number; sigma0Sq: number; sigmaU: number; T: number; steps: number; v: number; insider: boolean; seed: number }): KyleContinuousPath {
  const z = normalRng(o.seed);
  const { lambda } = kyleContinuous(o.sigma0Sq, o.sigmaU, o.T);
  const dt = o.T / o.steps;
  const t = [0], p = [o.p0], X = [0], Z = [0], profit = [0];
  for (let i = 0; i < o.steps; i++) {
    const ti = i * dt;
    const dX = o.insider ? ((o.v - p[i]) / (lambda * (o.T - ti))) * dt : 0;
    const dZ = o.sigmaU * Math.sqrt(dt) * z();
    // The insider's order is of size O(dt), so its own impact on its price is negligible: it trades at p_t.
    const pNext = p[i] + lambda * (dX + dZ);
    profit.push(profit[i] + (o.v - p[i]) * dX);
    t.push(ti + dt);
    p.push(pNext);
    X.push(X[i] + dX);
    Z.push(Z[i] + dZ);
  }
  return { t, p, X, Z, profit };
}
