# Options, Explained

An interactive, visual course on financial options. It runs from *"what is a call option?"* up to stochastic
volatility, numerical methods, and martingale pricing. The style is inspired by 3Blue1Brown: draw the picture
first, then write down the formula, and let the reader move the sliders.

> **Status:** the site is set up and Chapters 1–2 are written. The other 40 chapters are listed on the home page
> as "coming soon".

## What you'll find here

- **42 chapters in 10 parts**, ordered from easiest to hardest. Part I needs no math at all. Parts VII–X are
  graduate level, with the derivations written out in full. See [`docs/CURRICULUM.md`](docs/CURRICULUM.md).
- **Interactive figures in every chapter.** You drag a strike, change the volatility, or simulate paths, and the
  payoff, price, or distribution updates as you go.
- **Colour-coded math.** Each quantity keeps one colour everywhere, in the graphs and in the TeX. For example,
  spot $S$ is always blue and strike $K$ is always yellow. See [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md).

## Stack

| Layer | Choice |
|---|---|
| Site | [Astro](https://astro.build), static output deployed to GitHub Pages |
| Authoring | MDX: Markdown + TeX + interactive components in one file |
| Math typesetting | KaTeX (`remark-math` + `rehype-katex`) |
| Interactive plots | React islands + [Mafs](https://mafs.dev). D3 for custom viz. three.js (lazy-loaded) for 3D surfaces |
| Pricing core | TypeScript library in `src/lib/`, unit-tested with Vitest |

**Why this stack.** The browser is the only medium that gives both real interactivity and good math typesetting.
Writing about 40 raw HTML pages by hand would mean copying layout and plotting code into every page. So chapters
are written in MDX, and the site ships as static HTML. JavaScript only loads for the interactive widgets.

## Layout

```
docs/                    curriculum and style guide
src/content/chapters/    one .mdx file per chapter (prose + TeX + widgets)
src/components/plots/    interactive figures: PlotFrame, OptionTimeline, PayoffTracer, PayoffDiagram, ...
src/components/ui/       Slider, Segmented, Quiz, Callout, Tex/RichText, WidgetFrame
src/components/layout/   course navigation, theme toggle
src/lib/math/            normal pdf/cdf/inverse, seeded RNG + Brownian bridge, root finding
src/lib/pricing/         payoffs, Black–Scholes price and Greeks, CRR binomial tree
src/data/curriculum.ts   the 42-chapter outline used by the navigation
src/styles/              colour tokens (theme.css), prose, widgets
tests/                   Vitest checks of the math and pricing library
scripts/screenshots.mjs  visual check of every page (themes × desktop/phone)
```

## Roadmap

1. ✅ Curriculum and style guide
2. ✅ Scaffold: Astro, theme, core components, tested pricing library, Pages deployment
3. ✅ Chapters 1–2 as the reference implementation
4. ⬜ The remaining chapters, roughly one per PR, in order

## Running locally

Requires Node 22+.

```sh
npm install
npm run dev            # http://localhost:4321/options-explained/
npm test               # unit tests for src/lib
npm run build          # type check (astro check) + static build into dist/
npm run screenshots    # after a build: screenshots/ for every page, plus console/KaTeX/overflow checks
```

## Deployment

`.github/workflows/ci.yml` runs the tests and the build on every pull request. On pushes to `main` it also
deploys `dist/` to GitHub Pages at <https://jesusvillota.github.io/options-explained/>. This needs
**Settings → Pages → Source: GitHub Actions** to be switched on once.
