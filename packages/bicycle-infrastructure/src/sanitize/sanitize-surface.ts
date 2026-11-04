import { parseLength } from '../helpers/parse-length.ts'
import { sanitizeForLogging } from '../helpers/sanitize-for-logging.ts'
/** Port of topics/helper/sanitize_tags.lua > `surface` */
import type { OsmTags } from '../types.ts'
import { DISALLOWED } from '../types.ts'

const SURFACE_ALLOWED = [
  'asphalt',
  'paved',
  'unpaved',
  'concrete',
  'concrete:plates',
  'concrete:lanes',
  'paving_stones',
  'paving_stones:lanes',
  'sett',
  'bricks',
  'stone',
  'ground',
  'grass',
  'sand',
  'compacted',
  'fine_gravel',
  'gravel',
  'pebblestone',
  'wood',
  'woodchips',
  'metal',
  'metal_grid',
  'plastic',
  'rubber',
  'grass_paver',
] as const
const SURFACE_IGNORED = ['ice', 'snow', 'salt'] as const

/** Returns sanitized surface, the DISALLOWED sentinel, or undefined. */
export function sanitizeSurface(tags: OsmTags): string | undefined {
  if (tags.surface == null) return undefined
  const transformations: Record<string, string> = {
    earth: 'ground',
    mud: 'ground',
    clay: 'ground',
    dirt: 'ground',
    'dirt/sand': 'ground',
    cobblestone: 'large_sett',
    unhewn_cobblestone: 'large_sett',
    'cobblestone:flattened': 'large_sett',
    rock: 'stone',
    'stone:plates': 'stone',
    'paving_stones:20': 'paving_stones',
    'paving_stones:30': 'paving_stones',
    tartan: 'rubber',
  }
  if (transformations[tags.surface]) return transformations[tags.surface]

  if (tags.surface === 'sett') {
    const size = parseLength(tags['sett:length'])
    if (size != null && size <= 0.08) return 'mosaic_sett'
    if (size != null && size <= 0.13) return 'small_sett'
    if (size != null && size > 0.13) return 'large_sett'
  }

  return sanitizeForLogging(tags.surface, SURFACE_ALLOWED, SURFACE_IGNORED)
}

export { DISALLOWED }
