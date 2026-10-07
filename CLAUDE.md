# CLAUDE.md

This repo is an interactive, 3Blue1Brown-style course on options, in English, written for a curious reader and
going up to graduate level.

## Read first
- `docs/CURRICULUM.md` lists the 42 chapters, their goals, the key math, the planned widgets, and the
  prerequisites.
- `docs/STYLE_GUIDE.md` covers voice, the chapter template, notation, colour tokens, and widget rules.

## Stack
Astro (static) + MDX + KaTeX (`remark-math`/`rehype-katex`) + React islands (Mafs, D3; three.js lazy-loaded) +
Vitest. Deployed to GitHub Pages.

## Rules
- **One chapter per PR**, written in curriculum order unless asked otherwise. A chapter lives in
  `src/content/chapters/NN-slug.mdx`.
- **Follow the chapter template exactly:** Hook → Intuition → Formalisation → Playground → Check yourself →
  Recap & next up.
- **Use the colour semantics and the notation table from the style guide.** In TeX, colour with the macros
  (`\Spot`, `\Strike`, `\Call`, `\Put`, `\Time`, `\Vol`, `\Rate`), not raw `\color`. If you introduce a new
  symbol, add it to the notation table in the same PR.
- **All pricing and math lives in `src/lib/`, with Vitest tests against reference values.** Components import
  from it and never re-implement formulas.
- **Reuse the shared components** (`PayoffDiagram`, `BinomialTree`, `PathSimulator`, `BSPricer`, ...) before
  creating new ones. A new component should be general enough for the chapters listed in the curriculum's
  component table.
- **Default example parameters:** $S=K=100$, $r=5\%$, $q=0$, $\sigma=20\%$, $T=1$.
- **Simulations are seeded.** Animations respect `prefers-reduced-motion`. Widgets work at 360px width.

## Verify before pushing
- `npm run build` succeeds, and so does `npm test`.
- Take Playwright screenshots of every new or changed chapter in the dark and light themes and at phone width,
  and check them for KaTeX errors, overflow, and colour mistakes.
- Re-read the prose against the style guide's voice section.
