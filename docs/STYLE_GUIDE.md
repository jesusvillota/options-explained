# Style Guide

This guide is the house style for every chapter. Follow it so that 42 chapters, many of them written in
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
  reading of the idea next to it.

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

Gains and losses in readouts (`.good` / `.bad`) reuse the call and put colours, following the usual
green-is-up, red-is-down convention. Always pair them with a sign or a word ("+\$3", "loss") so colour is never the
only cue.

Neutral palette: background `#0F1117` (dark) / `#FAFAF7` (light), text `#E8E6E3` / `#1A1A1A`, axes and grid
lines in the text colour at 30% / 10% opacity.

In TeX, use the KaTeX macros defined in the site config. Don't use raw `\color{}`:

```tex
\Spot{S}, \Strike{K}, \Call{C}, \Put{P}, \Time{\tau}, \Vol{\sigma}, \Rate{r}
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
