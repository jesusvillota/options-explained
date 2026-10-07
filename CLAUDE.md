# CLAUDE.md

This repo is an interactive, 3Blue1Brown-style course on options, in English, written for a curious reader and
going up to graduate level.

## Read first
- `docs/CURRICULUM.md` lists the 42 chapters, their goals, the key math, the planned widgets, and the
  prerequisites.
- `docs/STYLE_GUIDE.md` covers voice, the chapter template, notation, colour tokens, and widget rules.
- `src/content/chapters/01-*.mdx` and `02-*.mdx` are the **reference chapters**. Copy their structure.

## Stack
Astro 7 (static, `base: /options-explained`) + MDX + KaTeX (`remark-math`/`rehype-katex` via the `unified`
processor in `astro.config.mjs`) + React 18 islands (Mafs; D3 and three.js to be added when needed) + Vitest.
Deployed to GitHub Pages by `.github/workflows/ci.yml`.

## Commands
- `npm test`: unit tests for `src/lib`
- `npm run build`: `astro check` plus the static build
- `npm run screenshots [filter]`: run after a build. It writes `screenshots/*.png` (dark/light × desktop/phone)
  and fails on console errors, KaTeX errors, or horizontal overflow.

## Rules
- **One commit per chapter, one PR per Part** (sessions can usually push to a single branch), written in
  curriculum order unless asked otherwise. A chapter lives in
  `src/content/chapters/NN-slug.mdx`, with frontmatter as in the style guide. It appears in the navigation on
  its own once the file exists. Keep `src/data/curriculum.ts` in sync with `docs/CURRICULUM.md`.
- **Follow the chapter template exactly:** Hook → Intuition → Formalisation → Playground → Check yourself →
  Recap & next up. Each `##` heading starts with `<span class="section-tag">Hook</span>` (etc.).
- **Use the colour semantics and the notation table from the style guide.** In TeX, colour with the macros
  (`\Spot`, `\Strike`, `\Call`, `\Put`, `\Time`, `\Vol`, `\Rate`, `\Prob`, defined in
  `src/lib/katexMacros.ts`), not raw `\color`. If you introduce a new symbol, add it to the notation table in
  the same PR.
- **Dollar signs:** `$…$` is math, so a literal dollar in MDX prose is written `\$`. Never put a `\$` inside
  math; write the number without it. In widget/quiz string props, the `RichText` component follows the same
  convention: `"\$5"` in an attribute string, or `"\\$5"` inside a JS string in `{…}`.
- **All pricing and math lives in `src/lib/`, with Vitest tests against reference values.** Components import
  from it and never re-implement formulas.
- **Widgets:** build them on `PlotFrame` (axes in data space at the plot edges) and `WidgetFrame` (title,
  plot, controls, readout, caption). Use `Label` from `PlotFrame`, not Mafs's `<Text>`, because Mafs's
  vertical `attach` offset points the wrong way. Use the `Slider`/`Segmented`/`Button` controls and the
  `useTweened` hook to morph between states. Colours are always CSS variables (`var(--c-call)`), never hex.
  Hydrate with `client:visible`.
- **Reuse the shared components** (`PayoffDiagram`, `OptionTimeline`, ...) before creating new ones. A new
  component should be general enough for the chapters listed in the curriculum's component table.
- **Default example parameters:** $S=K=100$, $r=5\%$, $q=0$, $\sigma=20\%$, $T=1$ (`DEFAULTS` in
  `src/lib/pricing/blackScholes.ts`).
- **Simulations are seeded.** Animations respect `prefers-reduced-motion`. Widgets work at 360px width.

## Verify before pushing
- `npm test` and `npm run build` both pass.
- Run `npm run screenshots`, then look at the pages for every new or changed chapter: both themes, desktop and
  phone. Check for overlapping labels, colour mistakes, and broken layout.
- Click through each new widget's controls in a browser (Playwright is installed) and check the readouts.
- Re-read the prose against the style guide's voice section.

## Gotchas
- `astro preview` in Astro 7 writes a lock file and can outlive `npx`. The screenshot script runs
  `node_modules/astro/bin/astro.mjs preview --ignore-lock` directly so that it can kill the server afterwards.
- Mafs renders nothing until it mounts. `WidgetFrame` reserves the plot height so the page doesn't jump.
