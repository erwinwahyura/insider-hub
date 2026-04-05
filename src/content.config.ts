import { defineCollection, z } from 'astro:content';

const newsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.string().datetime(),
    category: z.enum(['macro', 'micro']),
    impact: z.enum(['positive', 'negative', 'neutral']),
    region: z.string(),
    tickers: z.array(z.string()).default([]),
    source: z.string(),
    url: z.string().optional(),
  }),
});

export const collections = {
  news: newsCollection,
};
