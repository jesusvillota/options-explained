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
  {
    number: 11, roman: 'XI', title: 'Inside the options market', difficulty: '●–●●',
    chapters: [
      { number: 43, title: 'The limit order book' },
      { number: 44, title: 'Matching rules and fragmented markets' },
      { number: 45, title: 'Complex orders and auctions' },
      { number: 46, title: 'Clearing, margin and assignment' },
      { number: 47, title: 'Measuring liquidity' },
      { number: 48, title: 'No-arbitrage with frictions' },
    ],
  },
  {
    number: 12, roman: 'XII', title: 'Information and price formation', difficulty: '●●–●●●',
    chapters: [
      { number: 49, title: 'Inventory: why dealers charge to hold risk' },
      { number: 50, title: 'Adverse selection: Glosten–Milgrom' },
      { number: 51, title: "Kyle's model" },
      { number: 52, title: 'Kyle in continuous time' },
      { number: 53, title: 'Informed trading in options' },
      { number: 54, title: 'Price discovery across stock and options' },
    ],
  },
  {
    number: 13, roman: 'XIII', title: 'The options market maker', difficulty: '●●–●●●',
    chapters: [
      { number: 55, title: 'From noisy quotes to a clean surface' },
      { number: 56, title: 'Quoting around a theoretical value' },
      { number: 57, title: 'Optimal market making: Avellaneda–Stoikov' },
      { number: 58, title: 'Making markets in many options' },
      { number: 59, title: 'Hedging with transaction costs' },
      { number: 60, title: 'Demand-based option pricing' },
    ],
  },
  {
    number: 14, roman: 'XIV', title: 'Price impact and optimal execution', difficulty: '●●–●●●',
    chapters: [
      { number: 61, title: 'Price impact: what the data says' },
      { number: 62, title: 'Optimal execution: Almgren–Chriss' },
      { number: 63, title: 'Transient impact and resilient books' },
      { number: 64, title: 'Execution algorithms in practice' },
      { number: 65, title: 'Executing option trades' },
    ],
  },
  {
    number: 15, roman: 'XV', title: 'When hedging moves the market', difficulty: '●●',
    chapters: [
      { number: 66, title: 'Dealer gamma and feedback' },
      { number: 67, title: 'Pinning at expiry' },
      { number: 68, title: 'Zero-days-to-expiry options and intraday dynamics' },
      { number: 69, title: 'Liquidity spirals and volatility crashes' },
    ],
  },
  {
    number: 16, roman: 'XVI', title: 'High-frequency microstructure', difficulty: '●●●',
    chapters: [
      { number: 70, title: 'Order flow as a point process: Hawkes' },
      { number: 71, title: 'Queues, imbalance and the microprice' },
      { number: 72, title: 'Microstructure noise and realised volatility' },
      { number: 73, title: 'Speed, ticks and market design' },
    ],
  },
];

/** Join a path onto the site's base URL (GitHub Pages serves under /options-explained/). */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  return `${base}/${clean}`;
}
