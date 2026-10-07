# Options, Explained

An interactive, visual course on financial options. It runs from *"what is a call option?"* up to stochastic
volatility, numerical methods, and martingale pricing. The style is inspired by 3Blue1Brown: draw the picture
first, then write down the formula, and let the reader move the sliders.

> **Status:** planning. This repo has the curriculum and the style guide so far. The site scaffold comes next.

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

## Planned layout

```
docs/                 curriculum and style guide
src/content/chapters/ one .mdx file per chapter
src/components/       plots/, ui/, layout/
src/lib/              math/ (normal cdf, rng, root finding) and pricing/ (Black–Scholes, binomial, MC, ...)
src/styles/theme.css  colour tokens shared by plots and KaTeX
tests/                Vitest checks of the pricing library against reference values
```

## Roadmap

1. ✅ Curriculum and style guide (this PR)
2. ⬜ Scaffold: Astro, theme, core components, tested pricing library, Pages deployment
3. ⬜ Chapters 1–2 as the reference implementation
4. ⬜ The remaining chapters, roughly one per PR, in order

## Running locally

Not available yet. The commands (`npm install`, `npm run dev`, `npm test`) arrive with the scaffold PR.
