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
