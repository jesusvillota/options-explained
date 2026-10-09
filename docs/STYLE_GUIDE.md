# Style Guide

This guide is the house style for every chapter. Follow it so that 73 chapters, many of them written in
different sessions, read like one course.

## 1. Voice

- **Picture first, then the formula.** Show the shape before writing it down. A formula should feel like a
  summary of something the reader has already seen.
- **One idea per section.** If a section needs two "aha" moments, split it in two.
- **Start each chapter with a question the reader actually has.** For example: *"Why would anyone pay \$3 for
  the right to buy a stock at \$100?"*
- **Write to one reader, as "you".** Keep sentences short. Explain a term the first time it appears, and link
  back to the chapter that introduced it.
- **Give the honest version.** Simplify, but don't say false things. When a simplification is in play, say so
  ("we'll ignore dividends until Chapter 6").
- **Don't skip steps in derivations.** From Part IV on, write out every step. Steps that are pure algebra can go
  in a collapsible `<Details>` block, but they must be there.
- **Graduate rigour comes in gradually.** Parts I–III use intuition and arithmetic. Parts IV–VI bring in
  calculus and probability. Parts VII–X use measure-theoretic language where it helps, and always give a plain
  reading of the idea next to it. The microstructure Parts (XI–XVI) restart the ramp: Part XI is mostly
  institutions and arithmetic, and Parts XII–XVI bring in equilibrium models, stochastic control and point
  processes.

## 2. Chapter template

Every chapter is one MDX file in `src/content/chapters/NN-slug.mdx` and has these sections, in this order:

| # | Section | Purpose |
|---|---|---|
| 1 | **Hook** | A concrete question, puzzle, or surprising fact. About 1–3 paragraphs. |
| 2 | **Intuition** | The picture, interactive where possible. No heavy notation yet. |
| 3 | **Formalisation** | The TeX, colour-coded to match the picture. Derivations go here. |
| 4 | **Playground** | A widget the reader can explore freely. It ends with 1–2 "try this" prompts. |
| 5 | **Check yourself** | 2–3 short `<Quiz>` questions, answered client-side. Each answer has an explanation. |
| 6 | **Recap & next up** | 3–5 bullet takeaways and a one-line teaser for the next chapter. |

Frontmatter:

```yaml
---
title: "Payoff diagrams"
part: 1
chapter: 2
difficulty: 1          # 1 = intro, 2 = intermediate, 3 = advanced
prerequisites: [1]
summary: "What an option is worth at expiry, drawn as a picture."
---
```

Length: about 1,500–3,000 words of prose. If a chapter runs longer, split it.

## 3. Notation

Use these symbols everywhere. If a chapter needs a new symbol, add it to this table in the same PR.

| Symbol | Meaning |
|---|---|
| $S_t$, $S$ | Price of the underlying at time $t$ (spot) |
| $K$ | Strike |
| $T$ | Expiry date. $t$ is the current time and $\tau = T - t$ is the time to expiry |
| $r$ | Continuously compounded risk-free rate |
| $q$ | Continuous dividend yield |
| $\sigma$ | Volatility (annualised) |
| $\mu$ | Real-world drift |
| $C$, $P$ | Call and put prices. $V$ is a generic derivative price |
| $F$ | Forward price, $F = S e^{(r-q)\tau}$ |
| $B(t,T)$ | Discount factor (zero-coupon bond price) |
| $W_t$ | Standard Brownian motion |
| $\mathbb{P}$, $\mathbb{Q}$ | Real-world and risk-neutral probability measures. Never write $P$ for a probability, because $P$ is the put price |
| $\mathbb{E}^{\mathbb{Q}}[\cdot]$ | Expectation under $\mathbb{Q}$ |
| $N(\cdot)$, $\varphi(\cdot)$ | Standard normal CDF and PDF |
| $d_1, d_2$ | $d_{1,2} = \dfrac{\ln(S/K) + (r - q \pm \tfrac12\sigma^2)\tau}{\sigma\sqrt{\tau}}$ |
| $\Delta, \Gamma, \Theta, \mathcal{V}, \rho$ | Delta, gamma, theta, vega, rho. Write vega as $\mathcal{V}$ so it isn't confused with $\nu$ |
| $\hat\sigma$ | An estimate of $\sigma$ from data (historical volatility) |
| $C^{\text{mkt}}$ | An observed market price, as opposed to a model price such as $C_{\text{BS}}$ |
| $v_t$, $v_0$, $\theta$, $\kappa$, $\xi$ | Heston: instantaneous variance, its initial value, long-run variance, mean-reversion speed, vol of vol (Chapter 30). $\theta$ here is a variance level, not the time-step weight of Chapter 34 |
| $N_t$, $\lambda$, $J$, $\bar k$, $\mu_J$, $\delta$ | Jumps: Poisson counter, intensity, log jump size, mean relative jump $\mathbb{E}[e^J - 1]$, and Merton's jump mean and standard deviation (Chapter 31) |
| $\alpha$, $\beta$, $\nu$ | SABR: volatility level, backbone exponent, vol of vol (Chapter 32) |
| $H$, $B^H$ | Hurst exponent and fractional Brownian motion (Chapter 32) |
| $P(t, T)$, $F_i$, $\tau$, $A$, $S$ (rates) | Zero-coupon bond price, forward rate for period $i$, accrual fraction, swap annuity and forward swap rate (Chapter 41). In Chapter 41, $S$ is a swap rate, not a stock price |
| $Z_T$, $\theta$ (measure change) | Radon–Nikodym density $d\mathbb{Q}/d\mathbb{P}$ and market price of risk $(\mu - r)/\sigma$ (Chapter 40) |
| $A$, $D$, $E$ (credit) | Firm asset value, face value of debt, equity value in Merton's model (Chapter 42) |
| $\sigma_{\text{imp}}$, $\sigma_{\text{loc}}$ | Implied volatility and local (Dupire) volatility (Chapter 29) |
| $k$, $w$ | Log-moneyness $k = \ln(K/F)$ and total implied variance $w = \sigma_{\text{imp}}^2 T$ (Part VI) |
| $\theta_T$, $\rho$, $\eta$, $\psi$ | SSVI: at-the-money total variance, skew, wing level, and $\psi = \eta/\sqrt{\theta_T}$. In Part VI, $\rho$ is the smile's skew; in Parts VII and IX it's a correlation. Context always says which, and the Greek rho is written $\rho_{\text{call}}$ when ambiguous |
| $\text{RR}_{25}$, $\text{BF}_{25}$ | 25-delta risk reversal and butterfly, in volatility points |
| $\sigma_I$, $\sigma_R$ | Implied volatility (used to price and hedge) and realised volatility (what the stock actually does) |
| $N$ (as a count) | Number of rebalances or time steps, when it can't be confused with the normal CDF $N(\cdot)$ |
| $(x)^+$ | $\max(x, 0)$ |
| $m$, $n$ | Contract multiplier (100 shares for US stock options) and number of contracts |
| $n_i$, $p_i$ | Signed quantity of leg $i$ in a strategy (positive long, negative short) and its price per unit |
| $b$, $a$ | Bid and ask prices (per share) |
| $M$, $M_t$ | Mid-price $\tfrac12(b + a)$ (Part XI on). Not to be confused with the multiplier $m$ |
| $s$ | Quoted spread $a - b$ (Part XI on). In Chapter 42, $s$ is a credit spread |
| $Q$, $q_i$ | Size of an order, and the part of it filled at price level $i$ or allocated to order $i$ |
| $d_t$ | Trade sign: $+1$ for a buyer-initiated trade, $-1$ for a seller-initiated one |
| $a_i$, $A_i$; $b_i$, $B_i$ | Price and size of the $i$-th best offer and the $i$-th best bid in a book (Chapter 43) |
| $D_a(p)$, $D_b(p)$ | Cumulative depth: contracts offered at $p$ or less, bid at $p$ or more |
| $\bar p(Q)$, $p_{\text{last}}(Q)$ | Average and marginal (last-contract) fill price of an order of size $Q$ |
| $\Lambda$ | Arrival rate of orders, in contracts (or orders) per unit time |
| $\rho$ (depth) | Contracts per tick in a book with uniform depth (Chapter 43) |
| $a_{\text{pkg}}$, $b_{\text{pkg}}$ | A package's ask and bid (Chapter 45) |
| $h$ | A quoted half-spread around a value: the quote is value $\pm h$ |
| $L_{ij}$, $x_i$, $y_j$ | Risk array: the position's P&L under price move $x_i$ (relative) and volatility shift $y_j$ (Chapter 46) |
| $D$ (dividend) | A discrete cash dividend (Chapter 46). In Chapter 42, $D$ is a firm's debt |
| $m_t$, $u_t$, $\lambda$ | Efficient price, public news, and the permanent impact of one trade (Chapter 47 on). $\lambda$ is also Kyle's lambda (Chapter 51) |
| $e_t$, $\rho_t$, $\iota_t$ | Effective half-spread, realised half-spread and price impact of trade $t$ (Chapter 47) |
| $s_{\%}$, $s_\sigma$ | Spread as a fraction of the mid, and in volatility points $(a - b)/\mathcal{V}$ |
| $S^b$, $S^a$; $r_\ell$, $r_b$; $f$ | Stock bid and ask; lending and borrowing rates; the fee to borrow stock, as a yield (Chapter 48) |
| $B$ (box) | Price of a box spread (Chapter 48), not to be confused with a bid $b$ or a discount factor $B(t,T)$ |
| $\epsilon$ | Proportional transaction cost, as a fraction of the value traded |
| $q$, $q_t$ (inventory) | A dealer's inventory, in units (Parts XII–XIII, where there are no dividends, so no clash with the yield $q$) |
| $\gamma$ | Constant absolute risk aversion of a dealer or trader (Parts XII–XIV) |
| $r$ (reservation) | A dealer's reservation price $v - \gamma\sigma^2\tau q$ (Chapters 49 and 57). Interest rates play no role there |
| $v$ | Fair (or, in Chapters 50–52, true liquidation) value of an asset |
| $A$, $k$, $\lambda_0$ | Order-arrival intensity $A e^{-k\delta}$ at distance $\delta$ from fair value, and the rate $\lambda_0$ at the quoted half-spread (Chapters 49, 57). Here $k$ is not log-moneyness |
| $c$ (shading) | How far a dealer shades both quotes per unit of inventory (Chapter 49) |
| $v_L$, $v_H$, $p$, $\alpha$ | Glosten–Milgrom: low and high values, the market maker's belief $\mathbb{P}(v = v_H)$, and the share of insiders (Chapter 50). In this chapter $p$ is a probability, not a price |
| $p^+$, $p^-$ | Beliefs after a buy and after a sell (Chapter 50) |
| $p_0$, $\Sigma_0$, $x$, $u$, $y$, $\sigma_u$, $\beta$, $\lambda$ | Kyle: prior mean and variance of the value, the insider's order, the noise traders' order, total order flow, noise volatility, the insider's trading intensity and the price impact $p = p_0 + \lambda y$ (Chapters 51–52). $\beta$ here is not SABR's |
| $\Sigma_t$, $\theta_t$, $X_t$, $Z_t$, $Y_t$ | Continuous-time Kyle: the market's remaining variance, the insider's trading rate, and the cumulative orders of the insider, noise traders and both (Chapter 52) |
| $\Omega$ | An option's elasticity $\Delta S/V$ (Chapter 53) |
| $\kappa_i$, $\alpha_i$, $\psi$, $\Omega$ (VECM) | Price discovery: a market's speed of adjustment, its error-correction coefficient, the common-trend weights and the residual covariance (Chapter 54). Here $\Omega$ is a matrix, not an elasticity |
| $M^{\text{micro}}$, $V_b$, $V_a$ | Microprice, and the sizes at the best bid and ask (Chapter 55) |
| $\sigma^b$, $\sigma^a$, $\sigma^{\text{mid}}$ | Implied volatilities of a quote's bid, ask and mid (Chapter 55) |
| $e_\sigma$, $\ell$, $\bar\tau$, $\bar e$ | Quoting: half-spread in volatility points, the market maker's reaction time, snipers' mean reaction time, and customers' mean tolerance (Chapter 56) |
| $\delta^b$, $\delta^a$, $\omega$ | Distances of the bid and ask from the mid, and the Guéant–Lehalle–Fernandez-Tapia inventory skew per unit (Chapter 57) |
| $V_j$, $\Omega$, $d_j$ (book) | A book's vega in bucket $j$, the covariance of bucket vol moves, and the quote shift in vol points (Chapter 58) |
| $\sigma_L$, $\text{Le}$, $H$ | Leland's volatility and number, and the Whalley–Wilmott band's half-width (Chapter 59) |
| $d$, $\Sigma$, $p^0$, $c_i$, $s_\sigma$, $\pi$ | End users' net demand, the covariance of unhedgeable P&L, the hedgeable value, an option's delta-hedged crash loss, volatility uncertainty and crash probability (Chapter 60) |
| $Q$, $V$ (Part XIV), $\mathcal{I}$, $Y$, $\delta$ | A metaorder's size, the daily volume, its impact, the square-root law's prefactor and the impact exponent (Chapter 61) |
| $\rho(x) = Lx^{\alpha}$, $G$, $\beta$ (kernel), $G_\infty$, $\varepsilon_s$ | Latent liquidity at distance $x$ from the price, the propagator, its decay exponent and permanent floor, and the sign of the trade at time $s$ (Chapter 61) |
| $x_t$, $v_t$, $\eta$, $\lambda$ (Part XIV), $\gamma$, $\kappa$, $C$ | Shares still to trade, the trading rate, temporary and permanent impact, risk aversion, the urgency $\sqrt{\gamma\sigma^2/\eta}$ and the implementation shortfall (Chapter 62) |
| $q$ (book depth), $D_t$, $\rho$ (resilience), $f(v)$ | Shares per dollar above the ask, the dent left by past trades, the rate at which it refills, and the price push from trading at rate $v$ (Chapter 63) |
| $u_t$, $\nu$ (POV), $\pi$ (fill), $\tau$ (fill time), $p_d$, $p_a$ | Market volume rate, a POV algorithm's participation rate, a limit order's fill probability and fill time, and the decision and arrival prices (Chapter 64) |
| $Q_i$, $L_i$, $\sigma_{\text{vol}}$, $\bar\theta$, $\Spot{S}_{\text{ref}}$ | Vega bought at strike $i$, its daily traded vega, the daily volatility of implied volatility, the share of the half-spread paid when working an order, and a tied order's reference stock price (Chapter 65) |
| $\Gamma_D$, $\delta F$, $\text{GEX}_K$, $n_K$ | Dealers' net gamma in shares per dollar, the move the stock would make without hedging flows, gamma exposure at strike $K$, and dealers' net contracts there (Chapter 66) |
| $\sigma_{\text{loc}}(S, t)$, $n$ (pinning) | Local volatility created by hedging feedback, and hedgers' net contracts at the pinning strike (Chapter 67) |
| $\alpha$, $\delta$, $\mu$, $\varepsilon$ (PIN) | Chance of news, chance it's bad, informed and uninformed order rates per day (Chapter 53). Here $\mu$ is not a drift |
| $\mathcal{D}(p)$, $\mathcal{S}(p)$, $Q(p)$ | Demand, supply and tradable quantity at price $p$ in a call auction (Chapter 45) |
| $z_i$, $Z$ | Sizes of the orders resting at one price, and their total (Chapter 44) |
| $b^{\text{N}}$, $a^{\text{N}}$, $s^{\text{N}}$ | National best bid, best offer and their spread, across all exchanges |
| $f_v$ | Fee per contract on exchange $v$ (negative for a rebate) |
| $\theta$ (allocation) | A lead market maker's participation entitlement, as a share of an incoming order (Chapter 44) |

Conventions:
- Time is measured in years and rates are annualised and continuously compounded. Switch to discrete compounding
  only in Chapter 6, where comparing the two is the point.
- The default example is $S = 100$, $K = 100$, $r = 5\%$, $q = 0$, $\sigma = 20\%$, $T = 1$. When every chapter
  starts from the same numbers, readers can compare chapters directly.

## 4. Colour semantics

Each quantity keeps the same colour in plots, in TeX, and in prose highlights. These are the **only** semantic
colours. For anything else, use the neutral palette.

| Quantity | Token | Dark theme | Light theme |
|---|---|---|---|
| Spot $S$ / underlying | `--c-spot` | `#58C4DD` | `#1F7FA3` |
| Strike $K$ | `--c-strike` | `#F4D345` | `#A8860B` |
| Call | `--c-call` | `#83C167` | `#3E7F2A` |
| Put | `--c-put` | `#FC6255` | `#C0392B` |
| Time $t$, $T$, $\tau$ | `--c-time` | `#5CD0B3` | `#1E8C72` |
| Volatility $\sigma$ | `--c-vol` | `#B189C6` | `#7A4E94` |
| Rate $r$ | `--c-rate` | `#FF862F` | `#C25E12` |
| Probability / density | `--c-prob` | `#D7D7D7` (filled at 25% opacity) | `#555555` |
| Bid / buy side (Part XI on) | `--c-bid` | `#7C9BFF` | `#2F55C8` |
| Ask / sell side (Part XI on) | `--c-ask` | `#F27BC4` | `#B02D7E` |

Bid and ask get their own pair so that an order book never borrows the call and put colours: in a book for a
call, green and red would be read as "call" and "put". Buy orders and the bid side of a book are `--c-bid`; sell
orders and the ask side are `--c-ask`.

Gains and losses in readouts (`.good` / `.bad`) reuse the call and put colours, following the usual
green-is-up, red-is-down convention. Always pair them with a sign or a word ("+\$3", "loss") so colour is never the
only cue.

Neutral palette: background `#0F1117` (dark) / `#FAFAF7` (light), text `#E8E6E3` / `#1A1A1A`, axes and grid
lines in the text colour at 30% / 10% opacity.

In TeX, use the KaTeX macros defined in the site config. Don't use raw `\color{}`:

```tex
\Spot{S}, \Strike{K}, \Call{C}, \Put{P}, \Time{\tau}, \Vol{\sigma}, \Rate{r}, \Bid{b}, \Ask{a}
```

Colour a term only where it helps the reader match the formula to a plot. A formula where every symbol is
coloured is just as hard to read as one with no colour at all.

## 5. Widgets

- **Every widget works without explanation.** Label the axes with units, and show the current value next to
  every slider.
- **Every widget starts at the default example values** (§3), unless the chapter's point needs something else.
- **Widgets compute; they don't hard-code answers.** All pricing math comes from `src/lib/`, which is
  unit-tested. Never re-implement a formula inside a component.
- **Sliders have sensible ranges:** $S, K \in [50, 150]$; $\sigma \in [1\%, 100\%]$; $T \in [0.01, 3]$;
  $r \in [-2\%, 15\%]$.
- **Randomness is seeded.** Simulations take a seed and offer a "re-roll" button, so a figure the text describes
  looks the same on every load.
- **Motion has a purpose.** Animate a transition only when the change between states is the thing to learn,
  like a tree turning into a lognormal or a price converging. Respect `prefers-reduced-motion`.
- **Accessibility:** colour is never the only cue (also use line style or a label), widgets work by keyboard,
  each figure has an `aria-label` that summarises what it shows, and touch targets are at least 44px.
- **Phone layout:** every widget works at 360px width. Stack the controls below the plot instead of beside it.
- **Performance:** load widgets with `client:visible`, and lazy-load heavy libraries (three.js) only in the
  chapters that use them.

### Writing widgets into a chapter

```mdx
import PayoffDiagram from '../../components/plots/PayoffDiagram';
import Callout from '../../components/ui/Callout.astro';
import { Quiz, NumericQuiz } from '../../components/ui/Quiz';

<PayoffDiagram client:visible mode="profit" initialSpot={118} title="Payoff vs profit" />

<p class="try-this"><strong>Try this:</strong> drag the strike...</p>

<Callout type="key">The one idea to remember.</Callout>
```

- Put a short "Try this" prompt after each widget, telling the reader what to do with it.
- In MDX, write a literal dollar sign as `\$`, because `$…$` is math. Never write `\$` inside math.

## 6. Quizzes

- Mostly multiple choice. Use a numeric answer with a tolerance when computing something is the point.
- Each question tests one idea from the chapter. Avoid trick questions.
- Every answer, right or wrong, shows a 1–3 sentence explanation.

## 7. References

When a chapter is built on a classic source, end it with a short **Further reading** list. Examples: Hull,
*Options, Futures, and Other Derivatives*; Shreve, *Stochastic Calculus for Finance I & II*; Gatheral, *The
Volatility Surface*; and the original papers (Black–Scholes 1973, Merton 1973, Cox–Ross–Rubinstein 1979,
Breeden–Litzenberger 1978, Dupire 1994, Heston 1993).
