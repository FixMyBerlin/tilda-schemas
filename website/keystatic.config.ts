import { config } from '@keystatic/core'
import { KEYSTATIC_STORAGE_KIND } from 'astro:env/client'
import { keystaticAppsConfig } from './cms/apps.keystatic'
import { keystaticResearchConfig } from './cms/research.keystatic'

export default config({
  storage: {
    kind: KEYSTATIC_STORAGE_KIND,
    repo: {
      owner: 'FixMyBerlin',
      name: 'tilda-schemas',
    },
  },
  ui: {
    brand: { name: 'TILDA Schemas' },
    navigation: {
      Content: ['apps', 'research'],
    },
  },
  collections: {
    apps: keystaticAppsConfig,
    research: keystaticResearchConfig,
  },
  singletons: {},
})
