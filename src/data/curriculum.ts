/**
 * The full course outline (mirrors docs/CURRICULUM.md). Chapters that exist as
 * MDX files in src/content/chapters/ are linked; the rest show as "coming soon".
 */
export interface PartInfo {
  number: number;
  roman: string;
  title: string;
  difficulty: string;
  chapters: { number: number; title: string }[];
}

export const parts: PartInfo[] = [
  {
    number: 1, roman: 'I', title: 'What options are', difficulty: '●',
    chapters: [
      { number: 1, title: 'What is an option?' },
      { number: 2, title: 'Payoff diagrams' },
      { number: 3, title: 'Moneyness, intrinsic & time value' },
      { number: 4, title: 'How options trade' },
      { number: 5, title: 'Options as Lego: strategies' },
    ],
  },
  {
    number: 2, roman: 'II', title: 'No-arbitrage reasoning', difficulty: '●–●●',
    chapters: [
      { number: 6, title: 'Time value of money & forwards' },
      { number: 7, title: 'Arbitrage bounds' },
      { number: 8, title: 'Put–call parity' },
      { number: 9, title: 'Early exercise' },
      { number: 10, title: 'Shape constraints' },
    ],
  },
  {
    number: 3, roman: 'III', title: 'Pricing in discrete time', difficulty: '●●',
    chapters: [
      { number: 11, title: 'One-period binomial model' },
      { number: 12, title: 'The risk-neutral surprise' },
      { number: 13, title: 'Multi-period trees & backward induction' },
      { number: 14, title: 'From trees to Black–Scholes' },
    ],
  },
  {
    number: 4, roman: 'IV', title: 'Continuous time', difficulty: '●●–●●●',
    chapters: [
      { number: 15, title: 'Random walks → Brownian motion' },
      { number: 16, title: 'Geometric Brownian motion & the lognormal' },
      { number: 17, title: "Itô's lemma, intuitively" },
      { number: 18, title: 'The Black–Scholes formula' },
      { number: 19, title: 'The Black–Scholes PDE' },
      { number: 20, title: 'Black–Scholes playground' },
    ],
  },
  {
    number: 5, roman: 'V', title: 'Greeks & hedging', difficulty: '●●',
    chapters: [
      { number: 21, title: 'Delta & Gamma' },
      { number: 22, title: 'Theta and the Θ–Γ trade-off' },
      { number: 23, title: 'Vega, Rho & second-order Greeks' },
      { number: 24, title: 'Delta hedging in practice' },
    ],
  },
  {
    number: 6, roman: 'VI', title: 'Volatility', difficulty: '●●–●●●',
    chapters: [
      { number: 25, title: 'Historical vs implied volatility' },
      { number: 26, title: 'Smile, skew and the volatility surface' },
      { number: 27, title: 'Reading probabilities from prices' },
      { number: 28, title: 'Variance swaps & the VIX' },
    ],
  },
  {
    number: 7, roman: 'VII', title: 'Beyond Black–Scholes', difficulty: '●●●',
    chapters: [
      { number: 29, title: 'Local volatility (Dupire)' },
      { number: 30, title: 'Stochastic volatility (Heston)' },
      { number: 31, title: 'Jumps (Merton, Kou)' },
      { number: 32, title: 'SABR and rough volatility' },
    ],
  },
  {
    number: 8, roman: 'VIII', title: 'Numerical methods', difficulty: '●●–●●●',
    chapters: [
      { number: 33, title: 'Monte Carlo pricing' },
      { number: 34, title: 'Finite differences' },
      { number: 35, title: 'Fourier pricing' },
      { number: 36, title: 'American options by simulation' },
    ],
  },
  {
    number: 9, roman: 'IX', title: 'Exotic & multi-asset options', difficulty: '●●–●●●',
    chapters: [
      { number: 37, title: 'Path-independent exotics' },
      { number: 38, title: 'Path-dependent exotics' },
      { number: 39, title: 'Multi-asset options' },
    ],
  },
  {
    number: 10, roman: 'X', title: 'The deep theory & applications', difficulty: '●●●',
    chapters: [
      { number: 40, title: 'Martingale pricing, rigorously' },
      { number: 41, title: 'Interest-rate options' },
      { number: 42, title: 'Options everywhere' },
    ],
  },
];

/** Join a path onto the site's base URL (GitHub Pages serves under /options-explained/). */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  return `${base}/${clean}`;
}
