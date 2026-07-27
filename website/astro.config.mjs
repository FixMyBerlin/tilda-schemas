// ABOUT:
// Load env manually — https://docs.astro.build/en/guides/configuring-astro/#environment-variables
//
// USAGE:
// `bun run dev` — Keystatic enabled (local storage)
// `bun run build` — static production (Keystatic off) for GitHub Pages

import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import keystatic from '@keystatic/astro'
import { defineConfig, envField } from 'astro/config'
import { loadEnv } from 'vite'

const { ASTRO_ENABLE_KEYSTATIC } = loadEnv(process.env.NODE_ENV, process.cwd(), '')

export default defineConfig({
  site: 'https://fixmyberlin.github.io',
  base: '/tilda-schemas',
  integrations: [
    ASTRO_ENABLE_KEYSTATIC === 'true' ? keystatic() : undefined,
    react(),
    mdx(),
  ],
  output: 'static',
  env: {
    schema: {
      ASTRO_ENABLE_KEYSTATIC: envField.boolean({
        access: 'secret',
        context: 'server',
        optional: false,
      }),
      ASTRO_USE_NETLIFY_ADAPTER: envField.boolean({
        access: 'secret',
        context: 'server',
        optional: false,
      }),
      KEYSTATIC_STORAGE_KIND: envField.enum({
        values: ['local', 'github'],
        access: 'public',
        context: 'client',
        optional: false,
      }),
      ASTRO_ENV: envField.enum({
        values: ['development', 'staging', 'production'],
        access: 'public',
        context: 'client',
        optional: false,
      }),
      PUBLIC_CONCEPT_DOI: envField.string({
        access: 'public',
        context: 'client',
        optional: true,
        default: '',
      }),
    },
  },
})
