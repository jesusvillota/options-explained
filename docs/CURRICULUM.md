# Curriculum

There are 73 chapters in 16 parts. Parts I–X build the theory of pricing and hedging in a frictionless market.
Parts XI–XVI are about market microstructure: how options and their underlyings actually trade. Each chapter
builds on earlier ones. "Prereqs" lists the chapters a reader should have read first.

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
- **Widgets:** `LSMScatter`: at a chosen exercise date, the realised discounted cash flows of in-the-money paths,
  the quadratic regression and the exercise payoff; below, the boundary from every date against the binomial tree's.
  Readouts compare the price with an 800-step tree and the Black–Scholes European put. Library:
  `src/lib/numerics/lsm.ts`.
- **Prereqs:** 13, 33.

---

## Part IX — Exotic & multi-asset options ●●–●●●

### 37. Path-independent exotics
- **Goals:** Price digital, gap, and power options. Replicate digitals with call spreads, and understand
  pin risk.
- **Key math:** digital call $= e^{-r\tau}N(d_2)$; the limit of a call spread.
- **Widgets:** `DigitalSpread`: a call spread of adjustable width against the digital (payoffs at expiry) and their
  deltas today; near expiry the digital's delta becomes a spike at the strike (pin risk). Library:
  `src/lib/pricing/exotics.ts`.
- **Prereqs:** 18, 21.

### 38. Path-dependent exotics
- **Goals:** Price barrier options with the reflection principle. Price Asian and lookback options, and know
  which ones have closed forms.
- **Key math:** the reflection principle; down-and-out call formula; the geometric Asian closed form.
- **Widgets:** `BarrierReflection`: a driftless path touching the barrier and its mirror image after the first
  touch, plus the down-and-out call's value for every barrier level. `AsianMC`: a path with its running average and
  the arithmetic Asian by Monte Carlo, plain and with the geometric control variate, against the geometric closed
  form and the vanilla.
- **Prereqs:** 15, 33.

### 39. Multi-asset options
- **Goals:** Price the option to exchange one asset for another by changing numeraire. See how correlation
  affects basket and spread options.
- **Key math:** Margrabe's formula; correlated Brownian motions via the Cholesky factor.
- **Widgets:** `CorrelationBasket`: a correlation slider with a scatter of simulated year-end prices, and the basket
  call (Monte Carlo) and exchange option (Margrabe) priced against $\rho$. Library: `margrabe`, `twoAssetMC`,
  `basketCallLevy`, `correlatedPaths` in `src/lib/pricing/exotics.ts`.
- **Prereqs:** 18, 33.

---

## Part X — The deep theory & applications ●●●

### 40. Martingale pricing, rigorously
- **Goals:** State the fundamental theorems of asset pricing. Use Girsanov's theorem and change of numeraire.
  Reconnect each earlier "trick" to this one framework.
- **Key math:** $\frac{d\mathbb{Q}}{d\mathbb{P}}$; Girsanov; $V_t/N_t$ is a martingale under $\mathbb{Q}^N$.
- **Widgets:** `MeasureChange`: 20,000 outcomes simulated under $\mathbb{P}$ whose histogram morphs onto the
  risk-neutral density when reweighted by $d\mathbb{Q}/d\mathbb{P}$, the weight function, and the unweighted (wrong)
  and weighted (Black–Scholes) prices. Library: `src/lib/theory/measure.ts`.
- **Prereqs:** 18, 39.

### 41. Interest-rate options
- **Goals:** Price caps, floors, and swaptions with Black-76, and see the forward measure in use.
- **Key math:** Black-76; caplets as options on forward rates; the annuity measure for swaptions.
- **Widgets:** `YieldCurveCaplets`: a Nelson–Siegel curve (level, slope, hump) with zero and 3-month forward rates,
  a 5-year quarterly cap as Black-76 caplets, the floor, cap − floor = swap, and a 1y × 4y swaption against the
  caplets on the same periods. Library: `src/lib/rates/curve.ts` (curve, Black-76, Bachelier, caps, annuity, swap
  rate, swaptions).
- **Prereqs:** 40.

### 42. Options everywhere
- **Goals:** Recognise options outside the options market. Equity is a call on the firm's assets (Merton's
  credit model), and real options appear in investment decisions. Close with portfolio Greeks and a P&L
  explain.
- **Key math:** Merton's model with $E = $ a call on $A$ struck at $D$; the credit spread it implies.
- **Widgets:** `MertonCredit`: firm-value paths against the debt, equity/debt values, risk-neutral default
  probability and the credit-spread term structure. `PnLExplainWaterfall`: a small book's P&L for a chosen stock
  move, volatility move and days passed, split into delta, gamma, vega, theta, vanna and unexplained. Library:
  `src/lib/theory/credit.ts`, `src/lib/theory/pnlExplain.ts`.
- **Prereqs:** 18, 23.

## Part XI — Inside the options market ●–●●

Parts I–X priced options in a market without frictions: one price per option, trades of any size at that price.
Parts XI–XVI are about **market microstructure**: how real prices are formed by orders, who sets the bid and
the ask, what trading costs, and how trading moves the price. Part XI covers the institutions and the
measurements that the later, model-heavy Parts build on. The markets are synthetic and seeded throughout. Where
a rule differs between markets, the text describes the general mechanism and labels US listed equity options as
the running example.

### 43. The limit order book
- **Goals:** Explain limit and market orders, the bid and ask as the best resting limit orders, depth, the tick
  grid, and queue position under price–time priority. Walk the book with a large market order and compute its
  average fill price and slippage. Explain cancellations and marketable limit orders.
- **Key math:** the average fill price for size $Q$, $\bar p(Q) = \frac1Q\sum_i p_i q_i$; slippage
  $\bar p(Q) - M$ against the mid $M$; cumulative depth $D(p)$.
- **Widgets:** `OrderBook`: a seeded book for one option, shown as a depth ladder. You can send limit and market
  orders, watch them fill or join a queue, and see your queue position. `WalkTheBook`: the average fill price and
  slippage as functions of order size, drawn from the book's cumulative depth. Library: `src/lib/micro/orderBook.ts`
  (a matching engine).
- **Prereqs:** 4.

### 44. Matching rules and fragmented markets
- **Goals:** Compare price–time and pro-rata allocation, and priority for public customers. Explain why one option
  trades on many exchanges at once, how the best bid and offer across them (the NBBO) is formed, why routers must
  not trade through a better price elsewhere, and how exchange fees, rebates and payment for order flow change the
  net price.
- **Key math:** pro-rata allocation $q_i = \lfloor Q\, s_i / \sum_j s_j \rfloor$ with a rule for the remainder;
  $\text{NBBO} = (\max_v b_v, \min_v a_v)$; the net price $a + f$ (taker fee) or $b + \text{rebate}$.
- **Widgets:** `MatchingRules`: one incoming order filled against the same resting orders under price–time,
  pro-rata and customer-priority rules, showing who gets what. `NBBOBuilder`: three venues' books merging into
  the NBBO, with routing and fees. Library: `src/lib/micro/matching.ts`.
- **Prereqs:** 43.

### 45. Complex orders and auctions
- **Goals:** Trade a strategy (Chapter 5) as one package. Derive a spread's implied bid and ask from its legs, and
  see why a package can trade inside them. Measure legging risk. Find an opening auction's single clearing price.
- **Key math:** the package bid $b_{\text{pkg}} = \sum_{n_i>0} n_i b_i - \sum_{n_i<0}|n_i|\,a_i$ and the matching
  ask; the legging risk over a delay $\delta t$, $\mathrm{sd} \approx |\Delta|\,\sigma_S\sqrt{\delta t}$; the
  auction price $p^* = \arg\max_p \min\{D(p), S(p)\}$.
- **Widgets:** `SpreadFromLegs`: a vertical spread's quote built from its legs, against a tighter quote from a
  complex-order book. `CallAuction`: the supply and demand step curves of an opening auction crossing at the
  clearing price. Library: `src/lib/micro/packages.ts`, `src/lib/micro/auction.ts`.
- **Prereqs:** 5, 44.

### 46. Clearing, margin and assignment
- **Goals:** Explain the central counterparty: novation, netting, and the default waterfall. Explain random
  assignment and early-assignment risk for short calls before a dividend (Chapter 9). Compute strategy-based and
  risk-based (scenario) margin, and see why margin rises when markets get volatile.
- **Key math:** scenario margin $= \max_j \big[-\Delta V(\text{scenario}_j)\big]$ over a grid of price moves and
  volatility shifts; the netting benefit of a hedged book.
- **Widgets:** `MarginScenarios`: a small position's risk array, a heatmap of P&L over price and volatility
  shocks, with the margin as its worst cell. Compare a naked short put with a put spread. Library:
  `src/lib/micro/margin.ts`.
- **Prereqs:** 20, 44.

### 47. Measuring liquidity
- **Goals:** Define the quoted, effective and realised spreads and split the effective spread into a realised
  spread (what the liquidity provider keeps) and price impact (what it loses to informed flow). Estimate a spread
  from trade prices alone with Roll's estimator. Quote spreads in volatility points and see why far
  out-of-the-money options have huge percentage spreads but ordinary volatility spreads.
- **Key math:** effective half-spread $d_t(p_t - M_t)$ with $d_t = \pm1$ the trade sign; realised half-spread
  $d_t(p_t - M_{t+h})$; impact $d_t(M_{t+h} - M_t)$; Roll's $s = 2\sqrt{-\mathrm{Cov}(\Delta p_t, \Delta p_{t-1})}$;
  the volatility spread $(a - b)/\mathcal{V}$.
- **Widgets:** `SpreadDecomposition`: seeded trades with a slider for the informed share, splitting the effective
  spread into realised spread and impact. `ChainLiquidity`: a chain's spreads in dollars, in percent and in
  volatility points across strikes. Library: `src/lib/micro/liquidity.ts`.
- **Prereqs:** 23, 43.

### 48. No-arbitrage with frictions
- **Goals:** Turn Part II's bounds and put–call parity into bands: an arbitrage must beat the bid–ask spread,
  borrow fees and the gap between borrowing and lending rates. Read an implied borrow rate from parity and an
  implied financing rate from a box spread. See the striking result that with proportional costs, the cheapest
  super-replication of a call is to buy the stock.
- **Key math:** the parity band $S^b - K B_{\text{lend}} \le C - P \le S^a - K B_{\text{borrow}}$,
  read off as $a_C - b_P \ge S^b - K B_{\text{lend}}$ and $b_C - a_P \le S^a - K B_{\text{borrow}}$, plus a
  borrow fee for shorting the stock; the box-spread rate $-\ln\big(\text{box}/(K_2 - K_1)\big)/T$; the Soner–Shreve–Cvitanić theorem.
- **Widgets:** `ParityBand`: parity as a band around a line; arbitrage appears only where the quotes leave the
  band. `BoxSpreadRate`: the rate implied by a box's bid and ask. Library: `src/lib/micro/frictions.ts`.
- **Prereqs:** 8, 47.

---

## Part XII — Information and price formation ●●–●●●

### 49. Inventory: why dealers charge to hold risk
- **Goals:** Model a dealer facing random buy and sell orders. Without control, inventory wanders like a random
  walk. A risk-averse dealer shades both quotes against the inventory, which pulls it back towards zero. Derive
  the inventory component of the spread.
- **Key math:** the one-period reservation price $r = M - \gamma\sigma^2\tau\,q$ and the inventory spread
  $\gamma\sigma^2\tau$ per unit of size (Stoll, Ho–Stoll); Garman's ruin problem.
- **Widgets:** `InventoryDealer`: seeded Poisson buys and sells against a dealer, with quote shading on or off;
  inventory paths and the P&L distribution. Library: `src/lib/info/inventory.ts`.
- **Prereqs:** 16, 47.

### 50. Adverse selection: Glosten–Milgrom
- **Goals:** Derive a spread from information alone: a fraction of traders know the true value, and a
  competitive dealer sets the ask to the expected value given a buy. Update beliefs with Bayes' rule trade by
  trade, watch prices converge to the truth, and see the market break down when too many traders are informed.
  Prices are martingales (Chapter 40).
- **Key math:** $a = \mathbb{E}[v \mid \text{buy}]$, $b = \mathbb{E}[v \mid \text{sell}]$; the Bayesian update; the
  spread for a two-point value distribution.
- **Widgets:** `GlostenMilgrom`: a sequence of trades, the dealer's belief and the bid–ask band narrowing towards
  the true value, with a slider for the informed share. Library: `src/lib/info/glostenMilgrom.ts`.
- **Prereqs:** 12, 47.

### 51. Kyle's model
- **Goals:** Solve Kyle's (1985) one-period model in full: an insider, noise traders and a competitive market
  maker. Find the linear equilibrium as a fixed point of best responses. Interpret $\lambda$ (price impact) and
  $1/\lambda$ (market depth), the insider's profit, and why exactly half the private information gets into the
  price.
- **Key math:** $x = \beta(v - p_0)$, $p = p_0 + \lambda(x + u)$; $\beta = \sigma_u/\sqrt{\Sigma_0}$,
  $\lambda = \sqrt{\Sigma_0}/(2\sigma_u)$; $\mathrm{Var}(v \mid y) = \Sigma_0/2$; expected insider profit
  $\tfrac12\sigma_u\sqrt{\Sigma_0}$.
- **Widgets:** `KyleEquilibrium`: the insider's best response to a given $\lambda$ and the market maker's
  $\lambda$ given $\beta$, iterated to the fixed point; a scatter of order flow against price change. Library:
  `src/lib/info/kyle.ts`.
- **Prereqs:** 16, 50.

### 52. Kyle in continuous time
- **Goals:** Let the insider trade many times (Kyle 1985) and in continuous time (Back 1992). The insider trades
  gradually so as to stay hidden in the noise, information enters the price at a constant rate, and the price is
  a Brownian martingale that ends exactly at the true value. The insider's order flow turns the price into a
  Brownian bridge (Chapter 15).
- **Key math:** $dp_t = \lambda\,dY_t$ with $\lambda = \sqrt{\Sigma_0}/(\sigma_u\sqrt{T})$; the insider's rate
  $\dot x_t = (v - p_t)/\big(\lambda(T - t)\big)$; posterior variance $\Sigma_t = \Sigma_0(1 - t/T)$.
- **Widgets:** `KyleContinuous`: price paths converging to the insider's value, posterior variance shrinking
  linearly, and the insider's position. Library: `src/lib/info/kyle.ts`.
- **Prereqs:** 17, 51.

### 53. Informed trading in options
- **Goals:** Ask where an informed trader should trade: the stock, or options with their leverage and wider
  spreads (Easley–O'Hara–Srinivas). See how option order flow can predict stock returns, and how traders with
  information about volatility, not direction, use options. Estimate the probability of informed trading (PIN)
  by maximum likelihood.
- **Key math:** the PIN likelihood (a mixture of Poisson distributions) and
  $\text{PIN} = \alpha\mu/(\alpha\mu + 2\varepsilon)$; the venue choice as return per dollar after spreads.
- **Widgets:** `VenueChoice`: the informed trader's expected return in the stock and in each option as spreads
  change. `PINEstimator`: seeded days of buy and sell counts, fitted by maximum likelihood with Nelder–Mead.
  Library: `src/lib/info/pin.ts`, `src/lib/info/venue.ts`.
- **Prereqs:** 50, 51.

### 54. Price discovery across stock and options
- **Goals:** Two markets trade one underlying value. Back out an implied stock price from options with parity,
  measure which market moves first, and compute Hasbrouck information shares and Gonzalo–Granger component
  shares.
- **Key math:** observed prices $p^i_t = m_t + \text{noise}_t$ around a common efficient price $m_t$; the error
  correction model; the information share bounds.
- **Widgets:** `PriceDiscovery`: two noisy prices around one efficient price, with a slider for how fast each
  market reacts, and the estimated information shares. Library: `src/lib/info/priceDiscovery.ts`.
- **Prereqs:** 8, 53.

---

## Part XIII — The options market maker ●●–●●●

### 55. From noisy quotes to a clean surface
- **Goals:** Turn a raw chain into a volatility surface: choose between the mid, the size-weighted mid and the
  microprice; turn bid and ask into an implied-volatility band; back out the forward and the discount factor
  from parity across strikes; drop stale, crossed and zero-bid quotes; and fit a smile that stays inside the
  bid–ask band.
- **Key math:** the microprice $M^{\text{micro}} = (a\,V_b + b\,V_a)/(V_a + V_b)$; the parity regression
  $C - P = B(F - K)$; spread-weighted least squares in volatility.
- **Widgets:** `NoisyChainFit`: a seeded noisy chain, filters you can switch on and off, and an SVI fit with its
  bid–ask band. Library: `src/lib/mm/surfaceFit.ts`.
- **Prereqs:** 26, 48.

### 56. Quoting around a theoretical value
- **Goals:** Build quotes as theo plus edge, quoted in volatility rather than price. Tie quotes to the stock so
  they move with delta. See how slow quotes get picked off when the stock moves, and split a market maker's P&L
  into captured edge, hedging slippage and adverse selection.
- **Key math:** quotes $V(S, \sigma_{\text{theo}}) \pm (e_\sigma \mathcal{V} + e_0)$; the tied price
  $V + \Delta(S - S_{\text{ref}})$; the pick-off condition $|\Delta|\,|\delta S| > $ half-spread.
- **Widgets:** `QuoteEngine`: a moving stock, quotes refreshed with a latency you choose, a stream of ordinary
  orders and fast arbitrageurs, and the P&L breakdown. Library: `src/lib/mm/quoting.ts`.
- **Prereqs:** 21, 55.

### 57. Optimal market making: Avellaneda–Stoikov
- **Goals:** Set up market making as stochastic control: a dealer with exponential utility, a mid-price
  following Brownian motion, and fill rates that fall with distance from the mid. Derive the HJB equation, solve
  it approximately, and read off the reservation price and the optimal spread. Add inventory limits with the
  Guéant–Lehalle–Fernandez-Tapia solution.
- **Key math:** $r(M, q, t) = M - q\gamma\sigma^2(T - t)$;
  $\delta^a + \delta^b = \gamma\sigma^2(T - t) + \tfrac{2}{\gamma}\ln(1 + \gamma/k)$; fill intensity
  $\Lambda(\delta) = A e^{-k\delta}$.
- **Widgets:** `AvellanedaStoikov`: simulated quotes, fills and inventory for the optimal and the symmetric
  strategy, and the two P&L distributions. Library: `src/lib/mm/avellanedaStoikov.ts`.
- **Prereqs:** 19, 49.

### 58. Making markets in many options
- **Goals:** An options market maker's inventory is a vector of Greeks, not a share count. Hedge delta with the
  stock, net vega and gamma across strikes and expiries, and skew every quote by the book's total vega, weighted
  by each option's own vega.
- **Key math:** the volatility skew for option $i$ in bucket $j$,
  $\sigma_i^{\text{quote}} = \sigma_i - \gamma\sum_k \Omega_{jk}\,\mathcal{V}_{\text{book},k}$, where $\Omega$ is
  the covariance of volatility moves across expiry buckets.
- **Widgets:** `VegaBook`: trades arriving at several strikes, quotes skewed by book vega, and the vega
  inventory mean-reverting. Library: `src/lib/mm/optionBook.ts`.
- **Prereqs:** 23, 57.

### 59. Hedging with transaction costs
- **Goals:** Bring costs into Chapter 24's hedge: Leland's adjusted volatility, the trade-off between hedging
  error and cost that sets an optimal rebalancing frequency, utility-indifference prices (Hodges–Neuberger), and
  the Whalley–Wilmott no-trade band.
- **Key math:** $\sigma_L^2 = \sigma^2\big(1 \pm \sqrt{2/\pi}\,\epsilon/(\sigma\sqrt{\delta t})\big)$; the
  band half-width $\big(\tfrac32\,\epsilon\,S e^{-r\tau}\Gamma^2/\gamma\big)^{1/3}$.
- **Widgets:** `HedgeSimulator` gains a cost slider. `HedgeBands`: hedging by time versus by band, with cost and
  error for each. Library: `src/lib/pricing/hedging.ts` (costs), `src/lib/mm/transactionCosts.ts`.
- **Prereqs:** 24.

### 60. Demand-based option pricing
- **Goals:** Dealers can't hedge perfectly, so they need paying to absorb net demand. Show how end-user demand
  for one option raises its price and the prices of options correlated with it (Gârleanu–Pedersen–Poteshman). Use
  it to explain the index skew and the variance risk premium.
- **Key math:** the price shift $\partial p_i/\partial d_j = \gamma\,\mathrm{Cov}(\varepsilon_i, \varepsilon_j)$
  where $\varepsilon$ is the unhedgeable part of each option's P&L.
- **Widgets:** `DemandSmile`: drag the net demand at each strike and watch the smile respond. Library:
  `src/lib/mm/demand.ts`.
- **Prereqs:** 26, 58.

---

## Part XIV — Price impact and optimal execution ●●–●●●

### 61. Price impact: what the data says
- **Goals:** Separate temporary from permanent impact, and see why the impact of a large order (a metaorder)
  grows like the square root of its size rather than linearly. Show impact decaying after the order ends.
  Introduce the propagator model.
- **Key math:** the square-root law $I(Q) = Y\sigma_{\text{day}}\sqrt{Q/V_{\text{day}}}$; the propagator
  $p_t = p_0 + \sum_{s<t} G(t - s)\,\varepsilon_s$.
- **Widgets:** `SquareRootImpact`: metaorders of different sizes run through a book with latent liquidity, with
  impact against size on a log–log plot. `ImpactDecay`: price paths during and after a metaorder. Library:
  `src/lib/exec/impact.ts`.
- **Prereqs:** 43, 51.

### 62. Optimal execution: Almgren–Chriss
- **Goals:** Sell $X$ shares by time $T$ under linear permanent and temporary impact. Write the expected cost
  and its variance, minimise a mean–variance objective by the calculus of variations, and get the hyperbolic-sine
  trajectory. Trace the efficient frontier, from TWAP (no risk aversion) to selling at once.
- **Key math:** $\mathbb{E}[C] = \tfrac12\lambda X^2 + \eta\int_0^T \dot x_t^2\,dt$,
  $\mathrm{Var}[C] = \sigma^2\int_0^T x_t^2\,dt$; $x_t = X\sinh\big(\kappa(T - t)\big)/\sinh(\kappa T)$ with
  $\kappa = \sqrt{\gamma\sigma^2/\eta}$.
- **Widgets:** `AlmgrenChriss`: trajectories as risk aversion changes, the efficient frontier with the current
  strategy on it, and simulated cost distributions. Library: `src/lib/exec/almgrenChriss.ts`.
- **Prereqs:** 51, 61.

### 63. Transient impact and resilient books
- **Goals:** Let the book refill after each trade (Obizhaeva–Wang) and find the optimal strategy: a block at the
  start, steady trading, and a block at the end. Explain Gatheral's no-dynamic-arbitrage conditions, which rule
  out impact models that let a trader profit from pushing the price around.
- **Key math:** an exponentially decaying impact kernel $G(t) = e^{-\rho t}$ and the Obizhaeva–Wang solution;
  the condition on a power-law kernel's exponent.
- **Widgets:** `ResilientBook`: the book's dent refilling after trades, and the costs of different schedules.
  Library: `src/lib/exec/transientImpact.ts`.
- **Prereqs:** 62.

### 64. Execution algorithms in practice
- **Goals:** Compare benchmarks: arrival price, TWAP, VWAP and the close. Build a VWAP schedule from an intraday
  volume curve and a percentage-of-volume strategy. Choose between a limit order (cheaper, but may not fill) and
  a market order. Measure implementation shortfall after the fact.
- **Key math:** the VWAP schedule $x_t = X\big(1 - \int_0^t v_u\,du / \int_0^T v_u\,du\big)$; the expected cost
  of a limit order, $-\pi\,\tfrac{s}{2} + (1 - \pi)\,\mathbb{E}[\text{chase cost}]$, with $\pi$ the fill
  probability.
- **Widgets:** `VWAPTracker`: a VWAP schedule against a noisy volume day, with tracking error. `LimitVsMarket`:
  fill probability against distance from the mid, and the expected cost of each choice. Library:
  `src/lib/exec/algos.ts`.
- **Prereqs:** 62.

### 65. Executing option trades
- **Goals:** Work an order in a wide market: start at the mid, step towards the far side, and send stock-tied
  orders that stay delta-neutral. Execute a vega notional across strikes, measure impact in volatility points,
  and use block trades and requests for quote. Compare the round-trip cost of a volatility trade with the edge
  it hopes to earn.
- **Key math:** tied prices $V + \Delta(S - S_{\text{ref}})$; the breakeven realised volatility after costs.
- **Widgets:** `VolTradeExecution`: a vega order worked across strikes, with costs in dollars and in volatility
  points. Library: `src/lib/exec/optionExecution.ts`.
- **Prereqs:** 56, 62.

---

## Part XV — When hedging moves the market ●●

### 66. Dealer gamma and feedback
- **Goals:** Turn dealers' hedging into order flow: a dealer short gamma must buy as the stock rises and sell as
  it falls, which pushes the price further; a dealer long gamma does the opposite. Show realised volatility
  rising or falling with the dealers' net gamma, and map gamma exposure by strike.
- **Key math:** hedge flow $-\Gamma_{\text{dealer}}\,\delta S$ shares; with linear impact $\lambda$, the
  effective volatility $\sigma/(1 + \lambda\,\Gamma_{\text{dealer}})$, which grows when dealers are short gamma.
- **Widgets:** `DealerGammaSim`: seeded price paths with and without hedging feedback, and dealer gamma exposure
  by strike. Library: `src/lib/feedback/dealerGamma.ts`.
- **Prereqs:** 21, 61.

### 67. Pinning at expiry
- **Goals:** Explain why stocks with large open interest tend to close near a strike on expiry day: long-gamma
  hedgers sell rallies and buy dips close to the strike. Simulate the effect and see its size depend on open
  interest and liquidity.
- **Key math:** with long-gamma hedgers, the local volatility $\sigma/\big(1 + \lambda\,\Gamma(S, t)\big)$
  collapses near $K$ as $t \to T$, so the price gets stuck there.
- **Widgets:** `PinningHistogram`: the distribution of the closing price around a strike with and without
  hedgers. Library: `src/lib/feedback/pinning.ts`.
- **Prereqs:** 66.

### 68. Zero-days-to-expiry options and intraday dynamics
- **Goals:** Look at options in their last day: theta and gamma per hour, gamma exploding near the strike,
  volatility that follows a U-shape through the trading day, and event variance read off the term structure.
- **Key math:** $\Gamma_{\text{ATM}} \approx \varphi(0)/(S\sigma\sqrt{\tau})$; variance time
  $\int_t^T \sigma^2(u)\,du$ with intraday seasonality; event variance
  $\sigma^2_{\text{event}} = \sigma^2_{T_2}T_2 - \sigma^2_{T_1}T_1 - \sigma^2_{\text{base}}(T_2 - T_1)$.
- **Widgets:** `IntradayGamma`: an at-the-money option's value, gamma and theta through its final day.
  `EventVariance`: extracting the variance of an earnings day from two expiries. Library:
  `src/lib/feedback/intraday.ts`.
- **Prereqs:** 22, 66.

### 69. Liquidity spirals and volatility crashes
- **Goals:** See how mechanical hedging and margin calls can turn a fall into a crash: portfolio insurance in
  1987, margin and loss spirals (Brunnermeier–Pedersen), and the daily rebalancing of leveraged and inverse
  volatility products. Explain why the index skew became steep after 1987.
- **Key math:** the spiral multiplier $1/(1 - m)$; a leveraged product's rebalancing trade
  $L(L - 1)\,r_t\,\text{AUM}$.
- **Widgets:** `PortfolioInsuranceCrash`: a seeded market where synthetic-put hedgers and liquidity providers
  meet. `LeveragedRebalance`: rebalancing flows against the day's move. Library: `src/lib/feedback/spirals.ts`.
- **Prereqs:** 46, 66.

---

## Part XVI — High-frequency microstructure ●●●

### 70. Order flow as a point process: Hawkes
- **Goals:** Show that order arrivals cluster, so a Poisson model fails. Define the Hawkes process, its
  branching ratio and stationarity condition, simulate it by thinning, and fit it by maximum likelihood.
- **Key math:** $\lambda_t = \mu + \sum_{t_i < t} \alpha e^{-\beta(t - t_i)}$; branching ratio $\alpha/\beta < 1$;
  mean intensity $\mu/(1 - \alpha/\beta)$; the log-likelihood.
- **Widgets:** `HawkesFlow`: a seeded Hawkes process against a Poisson process with the same mean, with the
  intensity drawn over the events. Library: `src/lib/hf/hawkes.ts`.
- **Prereqs:** 31, 47.

### 71. Queues, imbalance and the microprice
- **Goals:** Model the best bid and ask queues as a Markov chain (Cont–Stoikov–Talreja) and compute the
  probability that the next mid-price move is up. Define order-book imbalance and Stoikov's microprice, and
  show order-flow imbalance explaining short-term price changes.
- **Key math:** the probability of an up-move as a function of the queue sizes; imbalance
  $\iota = V_b/(V_b + V_a)$; the regression $\delta M = \beta\,\text{OFI} + \text{noise}$.
- **Widgets:** `QueueRace`: two queues depleting and refilling, with the up-move probability against imbalance.
  Library: `src/lib/hf/queues.ts`.
- **Prereqs:** 43, 70.

### 72. Microstructure noise and realised volatility
- **Goals:** Explain why realised variance blows up when sampled too often: observed prices are the efficient
  price plus noise. Draw the volatility signature plot, find the best sampling frequency, and remove the noise
  with two-scale realised variance. Revisit Chapter 25's estimator and Chapter 28's variance swaps.
- **Key math:** $\mathbb{E}[\mathrm{RV}_n] = \sigma^2 T + 2n\,\omega^2$; the optimal $n^* \propto
  (\sigma^2 T/\omega^2)^{2/3}$; the two-scale estimator.
- **Widgets:** `SignaturePlot`: realised volatility against sampling interval for a noisy price, with the
  two-scale estimate. Library: `src/lib/hf/realizedNoise.ts`.
- **Prereqs:** 25, 47.

### 73. Speed, ticks and market design
- **Goals:** Explain latency arbitrage (Budish–Cramton–Shim): in a continuous market, fast traders snipe stale
  quotes after public news, and liquidity providers widen spreads to pay for it. Compare frequent batch auctions.
  Weigh tick sizes (spread against queue length) and the options-specific problems of millions of series and
  quoting obligations.
- **Key math:** the equilibrium half-spread at which the expected sniping loss equals the expected earnings from
  ordinary orders.
- **Widgets:** `SnipingRace`: quotes, a news jump, and a race between the provider's cancel and the snipers.
  `BatchAuction`: the same order flow in a continuous market and in batches. Library: `src/lib/hf/marketDesign.ts`.
- **Prereqs:** 44, 56.

---

## Shared components

| Component | First used | Reused in |
|---|---|---|
| `OptionTimeline` | 1 | 3, 9 |
| `PayoffTracer` | 2 | — |
| `PayoffDiagram` | 2 | 3, 5, 8 |
| `ConvexityChord` | 3 | 10, 22 |
| `TimeValueDiagram` | 3 | 9, 20, 21 |
| `OptionChain` | 4 | — |
| `CompoundingStaircase` | 6 | — |
| `ForwardArbitrageMachine` | 6 | 8 |
| `BoundsRegion` | 7 | 9, 10 |
| `ParityLine` | 8 | — |
| `EarlyExerciseValue` | 9 | 13 |
| `ExerciseBoundary` | 9 | 13 |
| `ConvexityEditor` | 10 | — |
| `OneStepReplication` | 11 | 12 |
| `RiskNeutralSlider` | 12 | — |
| `BinomialTreeAnimated` | 13 | — |
| `TreeConvergence` | 14 | — |
| `PathSimulator`, `BrownianZoom`, `QuadraticVariationDemo` | 15 | 16 |
| `GBMHistogram` | 16 | — |
| `ItoComparison` | 17 | — |
| `BSIntegrand` | 18 | — |
| `HeatDiffusion` | 19 | — |
| `Heatmap`, `BSPricer` | 20 | 23, 26, 29 |
| `StrategyBuilder` | 5 | 8, 10 |
| `TangentParabola` | 21 | — |
| `ThetaGammaBars` | 22 | — |
| `GreekExplorer` | 23 | — |
| `HedgeSimulator` | 24 | — |
| `HistoricalVolEstimator`, `NewtonIV` | 25 | — |
| `SmileExplorer` | 26 | — |
| `ButterflyDensity`, `ImpliedDensity` | 27 | — |
| `LogContractStrip`, `VixContributions` | 28 | — |
| `LocalVolMap`, `LocalVolDynamics` | 29 | — |
| `HestonSmile`, `HestonPaths` | 30 | — |
| `JumpPaths`, `JumpSmile` | 31 | — |
| `SABRSmileFit`, `RoughPaths` | 32 | — |
| `MCConvergence`, `MCErrorScaling` | 33 | — |
| `FDStability`, `FDConvergence` | 34 | — |
| `CharFnArrows`, `COSReconstruction` | 35 | — |
| `LSMScatter` | 36 | — |
| `DigitalSpread` | 37 | — |
| `BarrierReflection`, `AsianMC` | 38 | — |
| `CorrelationBasket` | 39 | — |
| `MeasureChange` | 40 | — |
| `YieldCurveCaplets` | 41 | — |
| `MertonCredit`, `PnLExplainWaterfall` | 42 | — |
| `OrderBook`, `WalkTheBook` | 43 | 44, 45, 71 |
| `MatchingRules`, `NBBOBuilder` | 44 | 73 |
| `SpreadFromLegs`, `CallAuction` | 45 | 65, 73 |
| `MarginScenarios` | 46 | 69 |
| `SpreadDecomposition`, `ChainLiquidity` | 47 | 53, 55 |
| `ParityBand`, `BoxSpreadRate` | 48 | 55 |
| `InventoryDealer` | 49 | 57 |
| `GlostenMilgrom` | 50 | 53 |
| `KyleEquilibrium` | 51 | 62 |
| `KyleContinuous` | 52 | — |
| `VenueChoice`, `PINEstimator` | 53 | — |
| `PriceDiscovery` | 54 | — |
| `NoisyChainFit` | 55 | 60 |
| `QuoteEngine` | 56 | 73 |
| `AvellanedaStoikov` | 57 | 58 |
| `VegaBook` | 58 | 60 |
| `HedgeBands` | 59 | — |
| `DemandSmile` | 60 | — |
| `SquareRootImpact`, `ImpactDecay` | 61 | 63, 66 |
| `AlmgrenChriss` | 62 | 64, 65 |
| `ResilientBook` | 63 | — |
| `VWAPTracker`, `LimitVsMarket` | 64 | — |
| `VolTradeExecution` | 65 | — |
| `DealerGammaSim` | 66 | 67, 69 |
| `PinningHistogram` | 67 | — |
| `IntradayGamma`, `EventVariance` | 68 | — |
| `PortfolioInsuranceCrash`, `LeveragedRebalance` | 69 | — |
| `HawkesFlow` | 70 | 71 |
| `QueueRace` | 71 | — |
| `SignaturePlot` | 72 | — |
| `SnipingRace`, `BatchAuction` | 73 | — |
| `Quiz`, `Slider`, `Toggle`, `Callout`, `Details` | 1 | all |

## Shared pricing library (`src/lib/`)

- **`math/`**: `normal` (pdf, cdf, inverse cdf), `rng` (seeded uniforms and normals, GBM paths, Brownian bridge),
  `brownian`, `lognormal`, `rootFind` (Newton, bisection), `complex`, `optimize` (Nelder–Mead), `fbm` (fractional
  Brownian motion, Hurst estimation).
- **`pricing/`**: `payoff`, `blackScholes` (price, Greeks, second-order Greeks), `binomial` (CRR, American,
  exercise boundary), `rates`, `bounds`, `parity`, `american`, `shape`, `strategy`, `oneStep`, `hedging`, `exotics`
  (digitals, gap, power, barriers, Asians, Margrabe, baskets).
- **`market/`**: `optionChain`.
- **`vol/`**: `impliedVol`, `smile` (SVI, SSVI, delta conventions), `density` (Breeden–Litzenberger),
  `varianceSwap` (log-contract strip, VIX).
- **`models/`**: `fourier` (Lewis pricing), `heston`, `jumps` (Merton, Kou), `localVol` (Dupire), `sabr`.
- **`numerics/`**: `finiteDifference` (θ-scheme, Rannacher), `monteCarlo`, `cos`, `lsm`.
- **`rates/`**: `curve` (Nelson–Siegel, Black-76, Bachelier, caps, swaptions).
- **`theory/`**: `measure` (Girsanov), `credit` (Merton), `pnlExplain`.
- **`micro/`** (Part XI): `orderBook` (matching engine), `matching` (allocation rules, NBBO, fees), `packages`, `auction`,
  `margin`, `liquidity` (spread measures, Roll), `frictions` (parity bands, box spreads).
- **`info/`** (Part XII): `inventory`, `glostenMilgrom`, `kyle` (one-period and continuous), `pin`, `venue`, `priceDiscovery`.
- **`mm/`** (Part XIII): `surfaceFit`, `quoting`, `avellanedaStoikov`, `optionBook`, `transactionCosts`, `demand`.
- **`exec/`** (Part XIV): `impact` (square-root law, propagator), `almgrenChriss`, `transientImpact`, `algos`,
  `optionExecution`.
- **`feedback/`** (Part XV): `dealerGamma`, `pinning`, `intraday`, `spirals`.
- **`hf/`** (Part XVI): `hawkes`, `queues`, `realizedNoise`, `marketDesign`.

Each module comes with Vitest checks against reference values from the published literature, for example Hull's
textbook examples, Haug's *Complete Guide to Option Pricing Formulas*, and Heston (1993).
