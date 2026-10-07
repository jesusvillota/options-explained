/**
 * Keep punctuation that directly follows inline math on the same line as the
 * formula ("$K$," must not wrap with the comma alone on the next line).
 * Runs after rehype-katex: wraps <span class="katex"> + leading punctuation of the
 * following text node in <span class="math-nobr">.
 */
const PUNCT = /^[,.;:!?)\]’”]+/;

/** The TeX source, from KaTeX's MathML <annotation>. */
function texSource(node) {
  let found = '';
  const visit = (n) => {
    if (found || !n) return;
    if (n.type === 'element' && n.tagName === 'annotation') found = (n.children ?? []).map((c) => c.value ?? '').join('');
    else (n.children ?? []).forEach(visit);
  };
  visit(node);
  return found;
}

/** Only short formulas are glued to their punctuation; long ones must stay free to wrap. */
const MAX_TEX_LENGTH = 40;

const isInlineKatex = (node) =>
  node && node.type === 'element' && node.tagName === 'span' && Array.isArray(node.properties?.className) && node.properties.className.includes('katex');

function walk(node) {
  if (!node.children) return;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const next = node.children[i + 1];
    if (isInlineKatex(child) && next && next.type === 'text' && texSource(child).length <= MAX_TEX_LENGTH) {
      const m = next.value.match(PUNCT);
      if (m) {
        node.children[i] = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['math-nobr'] },
          children: [child, { type: 'text', value: m[0] }],
        };
        next.value = next.value.slice(m[0].length);
        continue;
      }
    }
    walk(child);
  }
}

export default function rehypeMathPunctuation() {
  return (tree) => walk(tree);
}
