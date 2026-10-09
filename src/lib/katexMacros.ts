/**
 * KaTeX macros shared by server-rendered MDX math and client-side <Tex>.
 * Each macro wraps its argument in a CSS class so the colour follows the
 * active theme (see src/styles/theme.css). See docs/STYLE_GUIDE.md §4.
 */
export const katexMacros: Record<string, string> = {
  '\\Spot': '\\htmlClass{c-spot}{#1}',
  '\\Strike': '\\htmlClass{c-strike}{#1}',
  '\\Call': '\\htmlClass{c-call}{#1}',
  '\\Put': '\\htmlClass{c-put}{#1}',
  '\\Time': '\\htmlClass{c-time}{#1}',
  '\\Vol': '\\htmlClass{c-vol}{#1}',
  '\\Rate': '\\htmlClass{c-rate}{#1}',
  '\\Prob': '\\htmlClass{c-prob}{#1}',
  '\\Bid': '\\htmlClass{c-bid}{#1}',
  '\\Ask': '\\htmlClass{c-ask}{#1}',
};

export const katexOptions = {
  macros: katexMacros,
  trust: (ctx: { command: string }) => ctx.command === '\\htmlClass',
  strict: 'ignore' as const,
  throwOnError: false,
};
