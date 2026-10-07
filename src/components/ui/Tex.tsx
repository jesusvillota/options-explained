import katex from 'katex';
import { useMemo } from 'react';
import { katexOptions } from '../../lib/katexMacros';

interface TexProps {
  children: string;
  display?: boolean;
}

/** Client-side TeX for widgets, using the same colour macros as the chapter text. */
export function Tex({ children, display = false }: TexProps) {
  const html = useMemo(() => katex.renderToString(children, { ...katexOptions, displayMode: display }), [children, display]);
  return <span className={display ? 'tex-display' : 'tex'} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Text with inline math: "the strike $\Strike{K}$ costs \$5".
 * `$...$` is math; `\$` is a literal dollar sign (same convention as the MDX chapters).
 */
export function RichText({ children }: { children: string }) {
  const parts = useMemo(() => splitMath(children), [children]);
  return (
    <>
      {parts.map((p, i) => (p.math ? <Tex key={i}>{p.text}</Tex> : <span key={i}>{p.text}</span>))}
    </>
  );
}

export function splitMath(source: string): { text: string; math: boolean }[] {
  const out: { text: string; math: boolean }[] = [];
  let buf = '';
  let math = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\' && source[i + 1] === '$') {
      buf += math ? '\\$' : '$';
      i++;
    } else if (ch === '$') {
      if (buf) out.push({ text: buf, math });
      buf = '';
      math = !math;
    } else {
      buf += ch;
    }
  }
  if (buf) out.push({ text: buf, math });
  return out;
}
