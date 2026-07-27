import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { basePath } from './research.keystatic'
import { loader } from './utils/loader'

export const astroResearchDefinition = defineCollection({
  loader: loader(basePath, 'yaml'),
  schema: z.object({
    title: z.string(),
    url: z.string().url().optional(),
    description: z.string().optional(),
  }),
})
