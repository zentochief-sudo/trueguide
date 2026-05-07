import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articleSchema = z.object({
  title: z.string(),
  description: z.string(),
  destination: z.string(),
  category: z.enum(['Itinerary', 'Food', 'Tips', 'Culture', 'Budget', 'Transport', 'Nature', 'Practical', 'Experiences', 'Seasonal', 'Activities', 'Neighborhoods', 'Nightlife', 'Day Trips', 'Stadium Guide', 'Food & Drink']),
  publishDate: z.date(),
  updatedDate: z.date().optional(),
  heroImage: z.string().optional(),
  readingTime: z.number(),
  etsy_template: z.object({
    label: z.string(),
    url: z.string(),
  }).optional(),
  tags: z.array(z.string()).default([]),
  city: z.string().optional().default('national'),
  tocStyle: z.enum(['sticky-scroll', 'flow']).optional().default('sticky-scroll'),
});

export const collections = {
  japan: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/japan' }),
    schema: articleSchema,
  }),
  korea: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/korea' }),
    schema: articleSchema,
  }),
  usa: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/usa' }),
    schema: articleSchema,
  }),
  mexico: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/mexico' }),
    schema: articleSchema,
  }),
  canada: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/canada' }),
    schema: articleSchema,
  }),
};
