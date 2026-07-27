import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { basePath } from './apps.keystatic'
import { loader } from './utils/loader'

export const astroAppsDefinition = defineCollection({
  loader: loader(basePath, 'yaml'),
  schema: z.object({
    title: z.string(),
    url: z.string().url(),
    description: z.string().optional(),
  }),
})
