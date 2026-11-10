/** Port of the surface choice of roads_bikelanes/surfaceQuality/directional_surface.lua (without the hint tokens) */
import { allowedSurface } from '../sanitize/sanitize-surface.ts'
import type { OsmTags } from '../types.ts'
import { deriveSmoothness } from './derive-smoothness.ts'

/**
 * Order matters: per `token` (one half of the way) the first valid key counts, and on equal
 * badness the first value wins.
 */
const SURFACE_KEYS = [
  { key: 'surface:bicycle', token: 'surface_bicycle' },
  { key: 'surface:bicycle:right', token: 'surface_bicycle_right' },
  { key: 'surface:bicycle:forward', token: 'surface_bicycle_right' },
  { key: 'surface:bicycle:left', token: 'surface_bicycle_left' },
  { key: 'surface:bicycle:backward', token: 'surface_bicycle_left' },
  { key: 'surface:right', token: 'surface_right' },
  { key: 'surface:forward', token: 'surface_right' },
  { key: 'surface:left', token: 'surface_left' },
  { key: 'surface:backward', token: 'surface_left' },
] as const

const SMOOTHNESS_RANK: Record<string, number> = {
  excellent: 1,
  good: 2,
  intermediate: 3,
  bad: 4,
  very_bad: 5,
}

function badness(rawSurface: string): number {
  const smoothness = deriveSmoothness({ surface: rawSurface }).smoothness
  return (smoothness && SMOOTHNESS_RANK[smoothness]) || 0
}

/**
 * The worst of the directional, side and bicycle surface values (raw OSM value), or `undefined`
 * when none is in the allowlist or when `surface` itself is valid and stays.
 * The hint tokens of the LUA are not needed for the choice and not ported.
 */
export function worstDirectionalSurface(tags: OsmTags): string | undefined {
  if (allowedSurface(tags.surface, tags) != null) return undefined
  const seenTokens = new Set<string>()
  let worst: string | undefined
  for (const { key, token } of SURFACE_KEYS) {
    const raw = tags[key]
    if (raw == null || seenTokens.has(token) || allowedSurface(raw, tags) == null) continue
    seenTokens.add(token)
    if (worst == null || badness(raw) > badness(worst)) worst = raw
  }
  return worst
}
