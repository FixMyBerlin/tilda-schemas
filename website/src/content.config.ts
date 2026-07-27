import { astroAppsDefinition } from '../cms/apps.astro'
import { astroResearchDefinition } from '../cms/research.astro'

export const collections = {
  apps: astroAppsDefinition,
  research: astroResearchDefinition,
}
