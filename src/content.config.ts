import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const chapters = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/chapters' }),
  schema: z.object({
    title: z.string(),
    part: z.number().int().min(1).max(16),
    chapter: z.number().int().min(1),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    prerequisites: z.array(z.number().int()).default([]),
    summary: z.string(),
  }),
});

export const collections = { chapters };
