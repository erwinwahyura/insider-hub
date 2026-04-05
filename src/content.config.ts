import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const newsCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    category: z.string(),
    impact: z.string().optional(),
    region: z.string().optional(),
    tickers: z.array(z.string()).optional().default([]),
    source: z.string().optional(),
    url: z.string().optional(),
  }),
});

export const collections = {
  news: newsCollection,
};
