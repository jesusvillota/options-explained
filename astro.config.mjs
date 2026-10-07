// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { katexOptions } from './src/lib/katexMacros.ts';

// Deployed to GitHub Pages at https://jesusvillota.github.io/options-explained/
export default defineConfig({
  site: 'https://jesusvillota.github.io',
  base: '/options-explained',
  trailingSlash: 'always',
  integrations: [mdx(), react()],
  markdown: {
    // TeX: $inline$ and $$display$$, rendered to HTML at build time by KaTeX.
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, katexOptions]],
    }),
  },
});
