# Curriculum

There are 42 chapters in 10 parts. Each chapter builds on earlier ones. "Prereqs" lists the chapters a reader
should have read first.

Difficulty: ● intro (arithmetic only) · ●● intermediate (calculus and probability) · ●●● advanced (graduate
level: stochastic calculus, measure theory, numerical analysis).

Each chapter entry lists:
- **Goals**: what the reader can do after reading it.
- **Key math**: the formulas that must appear.
- **Widgets**: the interactive figures planned for it. Reusable components are named in `CodeStyle`.

Chapters 1–2 come first as the reference implementation, and the rest follow in order.

---

## Part I — What options are ●

### 1. What is an option?
- **Goals:** Tell a right apart from an obligation. Define a call and a put, strike, expiry, and premium. Say who
  buys options and why: to hedge, to speculate, or to earn income.
- **Key math:** none. The payoffs are given in words: "at expiry, a call pays the amount by which $S$ exceeds
  $K$, or nothing."
- **Widgets:** `OptionTimeline`: a stock path from today to expiry with a draggable end point. You pay a premium
  today, the stock moves, and you decide at expiry whether to exercise the call or put.
- **Prereqs:** none.

### 2. Payoff diagrams
- **Goals:** Draw and read payoff and profit diagrams for long and short calls and puts. See that the long
  holder's payoff is the short writer's loss.
- **Key math:** $(S_T - K)^+$, $(K - S_T)^+$; profit = payoff − premium.
- **Widgets:** `PayoffDiagram` with a draggable $K$, a long/short toggle, a call/put toggle, and a
  payoff/profit toggle. A marker for $S_T$ that the reader drags along the axis.
- **Prereqs:** 1.

### 3. Moneyness, intrinsic & time value
- **Goals:** Classify options as ITM, ATM, or OTM. Split a price into intrinsic value and time value, and
  explain where time value comes from (the kink plus uncertainty), and why it can be negative for a deep
  in-the-money European put.
- **Key math:** intrinsic $= (S-K)^+$; time value $=$ price $-$ intrinsic; two-outcome time value
  $\tfrac12(u - |S-K|)^+$ (Jensen); $\text{TV}_C - \text{TV}_P = K(1 - e^{-rT})$; $C_{ATM} \approx 0.4\,\sigma\sqrt{T} S$.
- **Widgets:** `ConvexityChord`: two equally likely futures on the hockey stick, with the chord's midpoint above
  it. `TimeValueDiagram`: the Black–Scholes price over the hockey stick, with time value shaded and a "run the
  clock" button. Black–Scholes is used as a black box for now.
- **Prereqs:** 2.

### 4. How options trade
- **Goals:** Explain the difference between European and American exercise, the contract multiplier, bid/ask,
  cash vs physical settlement, open interest, and how to read an option chain.
- **Key math:** none.
- **Widgets:** `OptionChain`: a synthetic but realistic chain (Black–Scholes prices on the tick grid, seeded
  volume and open interest) for three expiries. Clicking a bid or ask selects that trade and shows its cost,
  worst case, breakeven and profit per contract.
- **Prereqs:** 2.

### 5. Options as Lego: strategies
- **Goals:** Build bull/bear spreads, straddles, strangles, butterflies, iron condors, collars, covered calls and
  protective puts. Read each one's view on direction and volatility from its shape.
- **Key math:** a portfolio's payoff is the sum of its legs' payoffs (kinks at strikes, slopes add); breakevens
  per linear piece; every piecewise-linear payoff is cash + shares + calls,
  $f(S) = f(0) + s_0 S + \sum_k (s_k - s_{k-1})(S - K_k)^+$, so a put is $K - S + (S - K)^+$ at expiry.
- **Widgets:** `StrategyBuilder`: presets plus editable legs (call/put/stock, buy/sell, quantity, strike), with
  each leg ghosted behind the total and net cost, best/worst case and breakevens computed exactly.
- **Prereqs:** 2, 3.

---

## Part II — No-arbitrage reasoning ●–●●

### 6. Time value of money & forwards
- **Goals:** Discount cash flows with discrete and continuous compounding. Price a forward by cost of carry and
  explain why it doesn't depend on anyone's forecast.
- **Key math:** $B(0,T) = e^{-rT}$; $F = S e^{(r-q)T}$; the cash-and-carry arbitrage argument.
- **Widgets:** `CompoundingStaircase` (interest credited n times a year vs the smooth $e^{rt}$) and
  `ForwardArbitrageMachine` (drag a mispriced forward and the cash-and-carry or reverse trade appears, with cash
  flows).
- **Prereqs:** 1.

### 7. Arbitrage bounds
- **Goals:** Derive upper and lower bounds on call and put prices with no model at all.
- **Key math:** $\max(S - Ke^{-rT}, 0) \le C \le S$; $\max(Ke^{-rT} - S, 0) \le P \le Ke^{-rT}$.
- **Widgets:** `BoundsRegion`: the arbitrage-free band in $(S, C)$ or $(S, P)$ space with Black–Scholes inside,
  and a draggable market price that names the arbitrage trade when it leaves the band.
- **Prereqs:** 6.

### 8. Put–call parity
- **Goals:** Prove $C - P = S - Ke^{-rT}$ by replication. Build synthetic positions.
- **Key math:** put–call parity, with and without dividends.
- **Widgets:** `StrategyBuilder` preset *synthetic forward* (long call + short put = a forward), and `ParityLine`:
  C − P across strikes is a straight line crossing zero at the forward price, with chain quotes and their
  spreads, and a draggable quote that triggers a conversion or reversal.
- **Prereqs:** 6, 7.

### 9. Early exercise
- **Goals:** Show that an American call on a non-dividend stock is never exercised early, and explain why
  American puts sometimes are.
- **Key math:** $C^{Am} \ge S - Ke^{-rT} > S - K$; the put's early-exercise trade-off (interest on $K$ vs the
  insurance you give up).
- **Widgets:** `EarlyExerciseValue` (American vs European vs payoff, with the exercise region and early-exercise
  premium, for calls with dividends too) and `ExerciseBoundary` (the put's critical price $S^*(t)$ from the tree,
  with a random path that triggers exercise). Formalisation includes optimal stopping, smooth pasting and the
  perpetual put.
- **Prereqs:** 7, 8.

### 10. Shape constraints
- **Goals:** Show that the call price falls and is convex in $K$, and that the butterfly spread has
  non-negative value. Link this to probabilities (a preview of Ch. 27).
- **Key math:** $-e^{-rT} \le \partial C/\partial K \le 0$; $\partial^2 C/\partial K^2 \ge 0$.
- **Widgets:** `ConvexityEditor`: seven draggable call prices across strikes. A broken rule lights up with the
  spread or butterfly arbitrage, and a second panel turns butterflies into implied probabilities.
- **Prereqs:** 5, 7.

---

## Part III — Pricing in discrete time ●●

### 11. One-period binomial model
- **Goals:** Price an option by building a portfolio of stock and bond that replicates it. See that
  $\Delta = \frac{C_u - C_d}{S_u - S_d}$ falls out of the replication.
- **Key math:** the replication equations; no-arbitrage condition $d < e^{r\Delta t} < u$.
- **Widgets:** `OneStepReplication`: drag $S_u$ and $S_d$ on a one-step tree; below, the replicating portfolio is the
  straight line through the two payoffs, read at the forward and discounted.
- **Prereqs:** 6.

### 12. The risk-neutral surprise
- **Goals:** Understand why the real-world probability of "up" doesn't enter the price. Write the price as a
  discounted expectation under $\mathbb{Q}$.
- **Key math:** $q = \frac{e^{r\Delta t} - d}{u - d}$; $C = e^{-r\Delta t}\,\mathbb{E}^{\mathbb{Q}}[C_T]$.
- **Widgets:** `RiskNeutralSlider`: the real-world $p$ moves the stock's and call's expected returns but not the
  price; both earn $r$ exactly at $p = q$. Formalisation adds state prices and the one-period FTAP.
- **Prereqs:** 11.

### 13. Multi-period trees & backward induction
- **Goals:** Price on an $n$-step tree by backward induction. Price American options by comparing exercise with
  continuation at every node.
- **Key math:** the recursion $V_{i,j} = e^{-r\Delta t}[qV_{i+1,j+1} + (1-q)V_{i+1,j}]$, and its American
  version with $\max(\cdot, \text{exercise})$.
- **Widgets:** `BinomialTreeAnimated` (up to 8 steps) fills in values from the leaves back to the root, with
  early-exercise nodes highlighted for American options.
- **Prereqs:** 9, 12.

### 14. From trees to Black–Scholes
- **Goals:** Choose CRR parameters $u = e^{\sigma\sqrt{\Delta t}}$. See the terminal distribution approach a
  lognormal and the price converge to Black–Scholes.
- **Key math:** CRR parameters; a sketch of the CLT argument; the BS formula stated (derived in Ch. 18).
- **Widgets:** `TreeConvergence`: an $n$ slider (1–200); the tree's terminal distribution morphs into the lognormal,
  and the price-vs-$n$ plot zig-zags into the BS value.
- **Prereqs:** 13.

---

## Part IV — Continuous time ●●–●●●

### 15. Random walks → Brownian motion
- **Goals:** Build Brownian motion as the limit of a scaled random walk. Know its properties: independent
  Gaussian increments, continuous but nowhere differentiable paths, and $\sqrt{t}$ scaling.
- **Key math:** $W_t - W_s \sim \mathcal{N}(0, t-s)$; quadratic variation $[W]_t = t$.
- **Widgets:** `PathSimulator` (coin-flip walks vs Brownian motion, ±√t bands), `BrownianZoom` (self-similarity),
  `QuadraticVariationDemo` (Σ(ΔW)² → t while Σ|ΔW| → ∞).
- **Prereqs:** 14.

### 16. Geometric Brownian motion & the lognormal
- **Goals:** Model prices with GBM. Explain volatility drag: why the median grows at $\mu - \tfrac12\sigma^2$
  while the mean grows at $\mu$.
- **Key math:** $dS = \mu S\,dt + \sigma S\,dW$; $S_T = S_0 e^{(\mu - \frac12\sigma^2)T + \sigma W_T}$.
- **Widgets:** `GBMHistogram`: sample paths plus a histogram of $S_T$ against the lognormal, with mean and median
  lines that separate as $\sigma$ grows.
- **Prereqs:** 15.

### 17. Itô's lemma, intuitively
- **Goals:** See why the second-order Taylor term survives in stochastic calculus. Apply Itô's lemma to
  $\ln S$ and $S^2$.
- **Key math:** $(dW)^2 = dt$; $df = f_t\,dt + f_x\,dX + \tfrac12 f_{xx}(dX)^2$.
- **Widgets:** `ItoComparison`: $W_t^2$ vs the ordinary-chain-rule sum $\sum 2W\Delta W$ (short by $t$) and the
  Itô-corrected sum.
- **Prereqs:** 15, 16.

### 18. The Black–Scholes formula
- **Goals:** Derive the BS call price as a discounted risk-neutral expectation. Interpret $N(d_2)$ as
  $\mathbb{Q}(S_T > K)$ and $S N(d_1)$ as the share-measure term.
- **Key math:** $C = S e^{-q\tau} N(d_1) - K e^{-r\tau} N(d_2)$; the full integral derivation.
- **Widgets:** `BSIntegrand`: the risk-neutral (or share-measure) density with the in-the-money tail shaded
  ($N(d_2)$ or $N(d_1)$), and the integrand whose area is $e^{rT}C$.
- **Prereqs:** 12, 16.

### 19. The Black–Scholes PDE
- **Goals:** Derive the PDE from a delta-hedged portfolio. Transform it into the heat equation. See that the
  risk-neutral expectation and the PDE give the same answer, by Feynman–Kac.
- **Key math:** $V_t + \tfrac12\sigma^2S^2V_{SS} + (r-q)SV_S - rV = 0$; the change of variables to
  $u_\tau = u_{xx}$.
- **Widgets:** `HeatDiffusion`: the payoff diffusing as $\tau$ grows, solved live by Crank–Nicolson
  (`src/lib/numerics/finiteDifference.ts`) and matched against the formula.
- **Prereqs:** 17, 18.

### 20. Black–Scholes playground
- **Goals:** Build an intuitive feel for how each input moves the price.
- **Key math:** recap of the formula and its sensitivities (a teaser for Part V).
- **Widgets:** `BSPricer`: every input on a slider, with the price over $(S, \tau)$ as a `Heatmap` (canvas,
  theme-aware), plus challenge prompts.
- **Prereqs:** 18.

---

## Part V — Greeks & hedging ●●

### 21. Delta & Gamma
- **Goals:** Read $\Delta$ as the slope and $\Gamma$ as the curvature of the price curve. Use $\Delta$ as a
  hedge ratio.
- **Key math:** $\Delta_C = e^{-q\tau}N(d_1)$; $\Gamma = \frac{e^{-q\tau}\varphi(d_1)}{S\sigma\sqrt{\tau}}$;
  the Taylor expansion of P&L.
- **Widgets:** `TangentParabola`: the tangent line (delta) and the parabola that matches the curvature (gamma)
  at a draggable $S$, compared with the real price after a move; $\Delta(S)$ drawn below as $\tau$ shrinks.
- **Prereqs:** 20.

### 22. Theta and the Θ–Γ trade-off
- **Goals:** Understand time decay. Show that a long-gamma position pays for its convexity through theta.
- **Key math:** $\Theta + \tfrac12\sigma^2S^2\Gamma + (r-q)S\Delta = rV$; for a delta-hedged position,
  $\text{P\&L} \approx \tfrac12\Gamma S^2(\sigma_{\text{realised}}^2 - \sigma^2)\,dt$.
- **Widgets:** `TimeValueDiagram` running the clock at the money. `ThetaGammaBars`: one day's hedged P&L as a
  parabola in the day's move against the theta cost net of financing, breaking even at $\pm\sigma\sqrt{dt}$.
- **Prereqs:** 19, 21.

### 23. Vega, Rho & second-order Greeks
- **Goals:** Measure sensitivity to $\sigma$ and $r$. Know the cross-Greeks vanna, volga, and charm and where
  each matters.
- **Key math:** closed forms for $\mathcal{V}$, $\rho$, vanna, volga, charm.
- **Widgets:** `GreekExplorer`: pick any of delta, gamma, vega, theta, rho, vanna, volga or charm and see it as a
  `Heatmap` over $(S, \tau)$, with two colours for the two signs.
- **Prereqs:** 21.

### 24. Delta hedging in practice
- **Goals:** Simulate hedging at discrete times. See the error shrink like $1/\sqrt{n}$. See P&L depend on
  realised vs implied volatility. Understand gamma scalping.
- **Key math:** the hedging error variance; the P&L formula from Ch. 22.
- **Widgets:** `HedgeSimulator`: pick the hedge frequency and the realised and implied $\sigma$, simulate 400
  seeded paths (`src/lib/pricing/hedging.ts`), and compare the histogram of final P&L with the Derman–Kamal
  rule of thumb.
- **Prereqs:** 22.

---

## Part VI — Volatility ●●–●●●

### 25. Historical vs implied volatility
- **Goals:** Estimate historical volatility from returns. Back out implied volatility from a price with
  Newton–Raphson, with a bisection fallback.
- **Key math:** $\hat\sigma = \sqrt{252}\,\mathrm{sd}(\ln S_{i+1}/S_i)$; the Newton step
  $\sigma_{n+1} = \sigma_n - (C(\sigma_n) - C^{mkt})/\mathcal{V}(\sigma_n)$.
- **Widgets:** `HistoricalVolEstimator`: a rolling-window estimate on a simulated history whose volatility jumps
  from 15% to 40%, trading noise against lag. `NewtonIV`: Newton's tangents (or bisection's bracket) stepping
  along the $C(\sigma)$ curve to the market price, with an iteration table and a visible failure from a bad start.
  Library: `src/lib/vol/impliedVol.ts`.
- **Prereqs:** 23.

### 26. Smile, skew and the volatility surface
- **Goals:** See why implied vol varies with strike and maturity, and what the skew says about crash fears.
  Learn the coordinates: log-moneyness and delta.
- **Key math:** $\sigma_{imp}(K, T)$; total variance $w = \sigma^2 T$; a brief look at SVI.
- **Widgets:** `SmileExplorer`: an SSVI surface with equity, currency, commodity and flat presets and sliders
  for the ATM term structure, skew and wings. Smiles for five maturities against strike, log-moneyness or delta,
  or the whole surface as a `Heatmap`, with ATM / 25Δ risk reversal / 25Δ butterfly quotes and an arbitrage
  flag. Library: `src/lib/vol/smile.ts`.
- **Prereqs:** 25.

### 27. Reading probabilities from prices
- **Goals:** Recover the risk-neutral density from call prices. Connect it back to butterflies (Ch. 10).
- **Key math:** $f_{\mathbb{Q}}(K) = e^{rT}\,\partial^2 C/\partial K^2$ (Breeden–Litzenberger).
- **Widgets:** `ButterflyDensity`: butterflies of width \$20 to \$2 at every strike, priced from call prices and
  scaled by $e^{rT}/h^2$, converging onto the lognormal density. `ImpliedDensity`: an SSVI smile and the density
  it implies, against the lognormal, with tail probabilities and negative (arbitrage) regions in red.
  Library: `src/lib/vol/density.ts`.
- **Prereqs:** 10, 26.

### 28. Variance swaps & the VIX
- **Goals:** Replicate variance with a strip of out-of-the-money options. Understand how the VIX is built.
- **Key math:** the log-contract replication
  $-\ln(S_T/F) = \int_0^F \frac{(K-S_T)^+}{K^2}dK + \int_F^\infty \frac{(S_T-K)^+}{K^2}dK - \frac{S_T - F}{F}$.
- **Widgets:** `LogContractStrip`: out-of-the-money options weighted by $\Delta K/K^2$ summing to the log payoff,
  with strike spacing and range controls and the strip's fair variance-swap vol under a flat or skewed smile.
  `VixContributions`: the Cboe formula strike by strike for a 30-day smile, with the put share and the $K_0$
  correction. Library: `src/lib/vol/varianceSwap.ts`.
- **Prereqs:** 27.

---

## Part VII — Beyond Black–Scholes ●●●

### 29. Local volatility (Dupire)
- **Goals:** Find the single diffusion $\sigma(S, t)$ that matches the whole surface, and understand its limits,
  in particular its forward smile dynamics.
- **Key math:** Dupire's formula
  $\sigma_{loc}^2(K,T) = \frac{\partial_T C + (r-q)K\partial_K C + qC}{\tfrac12 K^2 \partial_{KK} C}$.
- **Widgets:** `LocalVolMap`: Dupire local vol of an SSVI surface as a `Heatmap` over $(S, t)$ with seeded
  local-vol paths overlaid, a toggle to the implied surface on the same scale, and the local/implied skew ratio
  (≈ 2). `LocalVolDynamics`: the smile local vol predicts after a spot move (Dupire's forward PDE from the new
  spot) against sticky strike and sticky moneyness. Library: `src/lib/models/localVol.ts`.
- **Prereqs:** 19, 27.

### 30. Stochastic volatility (Heston)
- **Goals:** Model variance as a mean-reverting process. See how correlation creates skew and vol-of-vol
  creates smile. Price with the characteristic function.
- **Key math:** $dv = \kappa(\theta - v)dt + \xi\sqrt{v}\,dW^v$ with $d\langle W^S, W^v\rangle = \rho\,dt$;
  the Feller condition; the semi-closed-form price.
- **Widgets:** `HestonSmile`: smiles at 1 month, 3 months and 1 year priced live from the characteristic function
  (Lewis integral), with presets, sliders for $\rho, \xi, \kappa, \sqrt{v_0}, \sqrt\theta$, the 90–110 skew,
  the variance-swap vol and the Feller condition. `HestonPaths`: one seeded path with its instantaneous
  volatility, reusing the same random numbers as parameters change. Library: `src/lib/models/heston.ts`,
  `src/lib/models/fourier.ts`.
- **Prereqs:** 26. The pricing integral is used here as given; Ch. 35 explains the Fourier method behind it.

### 31. Jumps (Merton, Kou)
- **Goals:** Add jumps to explain fat tails and steep short-dated skew. Understand that the market is
  incomplete.
- **Key math:** jump-diffusion SDE; Merton's series formula; compensator.
- **Widgets:** `JumpPaths`: seeded Merton paths with up- and down-jumps marked. `JumpSmile`: the log-return
  density on a log scale against a normal with the same variance (1 week, 1 month, 1 year), and Merton smiles at
  four maturities with the 95–105 skew term structure. Library: `src/lib/models/jumps.ts` (Merton series and
  characteristic function, Kou characteristic function, paths).
- **Prereqs:** 26.

### 32. SABR and rough volatility
- **Goals:** Understand SABR's place in rates markets and the Hagan approximation. Get an intuitive picture of
  rough volatility (Hurst exponent $H < 1/2$).
- **Key math:** SABR dynamics; Hagan's implied vol formula; fractional Brownian motion.
- **Widgets:** `SABRSmileFit`: Hagan's formula against stylised swaption quotes, with β presets, sliders, a
  least-squares fit (Nelder–Mead) and the smile after a forward move (the backbone). `RoughPaths`: fractional
  Brownian motion for any $H$ next to Brownian motion from the same random numbers, the rough volatility it drives,
  and $H$ estimated back from the path. Library: `src/lib/models/sabr.ts`, `src/lib/math/fbm.ts`,
  `src/lib/math/optimize.ts`.
- **Prereqs:** 30.

---

## Part VIII — Numerical methods ●●–●●●

### 33. Monte Carlo pricing
- **Goals:** Price by simulation. Understand error of order $1/\sqrt{N}$. Use antithetic variates and control
  variates.
- **Key math:** the estimator and its confidence interval; variance reduction formulas.
- **Widgets:** `MCConvergence`: the running estimate on a log axis with its ±2 standard-error band against the
  Black–Scholes value, for plain, antithetic and control-variate estimators. `MCErrorScaling`: standard error
  against N on log–log axes for all three, with the variance-reduction factors. Library:
  `src/lib/numerics/monteCarlo.ts`.
- **Prereqs:** 18.

### 34. Finite differences
- **Goals:** Discretise the BS PDE. Compare explicit, implicit, and Crank–Nicolson schemes, and understand
  stability and the CFL condition.
- **Key math:** the difference stencils; the stability condition $\Delta t \lesssim \Delta S^2/(\sigma^2 S^2)$.
- **Widgets:** `FDStability`: a live θ-scheme solver (explicit, implicit, Crank–Nicolson, CN + Rannacher) on 100
  price steps; below 393 time steps the explicit scheme's rounding errors grow into a visible sawtooth.
  `FDConvergence`: time-discretisation error against steps on log–log axes (slopes −1 and −2). Library:
  `src/lib/numerics/finiteDifference.ts` (now with Rannacher start-up and the explicit stability limit).
- **Prereqs:** 19.

### 35. Fourier pricing
- **Goals:** Price from a characteristic function with the Carr–Madan FFT and the COS method.
- **Key math:** the damped call transform; the COS expansion.
- **Widgets:** `CharFnArrows`: φ(u) as the average of unit arrows at angles $uX$ over sampled log-returns
  (Black–Scholes, Heston, Merton), against the exact φ. `COSReconstruction`: the density rebuilt from N cosine
  terms and the price error against N on a log scale (exponential convergence). Library:
  `src/lib/numerics/cos.ts`, `src/lib/models/fourier.ts`.
- **Prereqs:** 18; a basic idea of Fourier series.

### 36. American options by simulation
- **Goals:** Price American options with Longstaff–Schwartz regression.
- **Key math:** the continuation value regressed on basis functions; the exercise rule.
- **Widgets:** a scatter of discounted continuation values against $S$ with the fitted regression curve, and
  the exercise boundary emerging as time steps back.
- **Prereqs:** 13, 33.

---

## Part IX — Exotic & multi-asset options ●●–●●●

### 37. Path-independent exotics
- **Goals:** Price digital, gap, and power options. Replicate digitals with call spreads, and understand
  pin risk.
- **Key math:** digital call $= e^{-r\tau}N(d_2)$; the limit of a call spread.
- **Widgets:** a call spread narrowing into a digital, with its delta spiking near expiry.
- **Prereqs:** 18, 21.

### 38. Path-dependent exotics
- **Goals:** Price barrier options with the reflection principle. Price Asian and lookback options, and know
  which ones have closed forms.
- **Key math:** the reflection principle; down-and-out call formula; the geometric Asian closed form.
- **Widgets:** a path hitting a barrier, with its reflected twin drawn alongside. A Monte Carlo pricer for
  arithmetic Asians.
- **Prereqs:** 15, 33.

### 39. Multi-asset options
- **Goals:** Price the option to exchange one asset for another by changing numeraire. See how correlation
  affects basket and spread options.
- **Key math:** Margrabe's formula; correlated Brownian motions via the Cholesky factor.
- **Widgets:** a slider for correlation $\rho$, showing joint paths and the basket's price.
- **Prereqs:** 18, 33.

---

## Part X — The deep theory & applications ●●●

### 40. Martingale pricing, rigorously
- **Goals:** State the fundamental theorems of asset pricing. Use Girsanov's theorem and change of numeraire.
  Reconnect each earlier "trick" to this one framework.
- **Key math:** $\frac{d\mathbb{Q}}{d\mathbb{P}}$; Girsanov; $V_t/N_t$ is a martingale under $\mathbb{Q}^N$.
- **Widgets:** the same paths reweighted under $\mathbb{P}$ and $\mathbb{Q}$, with the density shifting as the
  measure changes.
- **Prereqs:** 18, 39.

### 41. Interest-rate options
- **Goals:** Price caps, floors, and swaptions with Black-76, and see the forward measure in use.
- **Key math:** Black-76; caplets as options on forward rates; the annuity measure for swaptions.
- **Widgets:** a yield curve that the reader shifts, with caplet prices updating.
- **Prereqs:** 40.

### 42. Options everywhere
- **Goals:** Recognise options outside the options market. Equity is a call on the firm's assets (Merton's
  credit model), and real options appear in investment decisions. Close with portfolio Greeks and a P&L
  explain.
- **Key math:** Merton's model with $E = $ a call on $A$ struck at $D$; the credit spread it implies.
- **Widgets:** firm value paths and the default probability. A P&L explain waterfall for an options book.
- **Prereqs:** 18, 23.

---

## Shared components (planned)

| Component | First used | Reused in |
|---|---|---|
| `OptionTimeline` | 1 | 3, 9 |
| `PayoffTracer` | 2 | — |
| `PayoffDiagram` | 2 | 3, 5, 8, 37 |
| `ConvexityChord` | 3 | 10, 22 |
| `TimeValueDiagram` | 3 | 9, 20, 21 |
| `OptionChain` | 4 | — |
| `CompoundingStaircase` | 6 | — |
| `ForwardArbitrageMachine` | 6 | 8 |
| `BoundsRegion` | 7 | 9, 10 |
| `ParityLine` | 8 | — |
| `EarlyExerciseValue` | 9 | 13, 36 |
| `ExerciseBoundary` | 9 | 13, 36 |
| `ConvexityEditor` | 10 | — |
| `OneStepReplication` | 11 | 12 |
| `RiskNeutralSlider` | 12 | 40 |
| `BinomialTreeAnimated` | 13 | 36 |
| `TreeConvergence` | 14 | 33 |
| `PathSimulator`, `BrownianZoom`, `QuadraticVariationDemo` | 15 | 16, 24, 33 |
| `GBMHistogram` | 16 | 33 |
| `ItoComparison` | 17 | — |
| `BSIntegrand` | 18 | 37, 40 |
| `HeatDiffusion` | 19 | — |
| `Heatmap`, `BSPricer` | 20 | 23, 26, 29 |
| `StrategyBuilder` | 5 | 8, 10 |
| `TangentParabola` | 21 | — |
| `ThetaGammaBars` | 22 | — |
| `GreekExplorer` | 23 | — |
| `HedgeSimulator` | 24 | — |
| `HistoricalVolEstimator`, `NewtonIV` | 25 | — |
| `SmileExplorer` | 26 | — |
| `ButterflyDensity`, `ImpliedDensity` | 27 | 37 |
| `LogContractStrip`, `VixContributions` | 28 | — |
| `LocalVolMap`, `LocalVolDynamics` | 29 | — |
| `HestonSmile`, `HestonPaths` | 30 | — |
| `JumpPaths`, `JumpSmile` | 31 | — |
| `SABRSmileFit`, `RoughPaths` | 32 | 41 |
| `MCConvergence`, `MCErrorScaling` | 33 | — |
| `FDStability`, `FDConvergence` | 34 | — |
| `CharFnArrows`, `COSReconstruction` | 35 | — |
| `Quiz`, `Slider`, `Toggle`, `Callout`, `Details` | 1 | all |

## Shared pricing library (planned, `src/lib/`)

`normal` (pdf, cdf, inverse cdf) · `rng` (seeded, Box–Muller) · `rootFind` (Newton, bisection) · `blackScholes`
(price, Greeks) · `binomial` (European/American, CRR) · `monteCarlo` (GBM paths, estimators, variance reduction)
· `finiteDifference` (explicit/implicit/CN) · `impliedVol` · `heston` (char. function, COS) · `merton` (jump
series) · `barrier`, `asian`, `margrabe`, `black76`.

Each module comes with Vitest checks against reference values from the published literature, for example Hull's
textbook examples, Haug's *Complete Guide to Option Pricing Formulas*, and Heston (1993).
