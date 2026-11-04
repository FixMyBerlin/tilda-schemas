import { parseWidth } from '@tilda-geo/bicycle-infrastructure'
import type { OsmTags } from '../types.ts'

/**
 * Width tags: the road width used to place side bands, and which part of the street a width key
 * describes. Values are read with `parseWidth` of `@tilda-geo/bicycle-infrastructure` (m, cm, km,
 * decimal commas, like the LUA processing); there is no second parser.
 *
 * The fallback widths are ported from street-space-editor (`app/src/modes/width/domain/`), which
 * ports them from tilda-geo-cqi `highway_width_fallbacks.lua`.
 */

export type WidthSide = 'left' | 'right'

/** What a width key describes: the whole way, or a lane/sidewalk on one or both sides */
export type WidthTarget =
  | { kind: 'way' }
  | { kind: 'side'; prefix: 'cycleway' | 'sidewalk'; sides: WidthSide[] }

const DEFAULT_FALLBACK = 10

const HIGHWAY_WIDTH_NO_ONEWAY: Record<string, number> = {
  motorway: 22,
  trunk: 20,
  primary: 18,
  secondary: 14,
  tertiary: 10,
  motorway_link: 9,
  trunk_link: 9,
  primary_link: 6,
  secondary_link: 6,
  tertiary_link: 6,
  residential: 8,
  unclassified: 8,
  living_street: 5,
  pedestrian: 8,
  road: 8,
  service: 4,
  bus_guideway: 3,
  track: 2.5,
  footway: 2.5,
  path: 2.5,
  bridleway: 2.5,
  cycleway: 2,
  steps: 2,
}

const HIGHWAY_WIDTH_ONEWAY: Record<string, number> = {
  ...HIGHWAY_WIDTH_NO_ONEWAY,
  motorway: 15,
  trunk: 15,
  primary: 12,
  secondary: 9,
  tertiary: 7,
}

const SIDE_WIDTH_KEY = /^(cycleway|sidewalk):(left|right|both):width$/
const WAY_WIDTH_KEYS = new Set(['width', 'est_width'])

function isOneway(tags: OsmTags) {
  if (tags.oneway === 'yes' || tags.oneway === '-1') return true
  if (tags.oneway === 'no') return false
  return (
    tags.junction === 'roundabout' ||
    tags.highway === 'motorway' ||
    tags.highway === 'motorway_link'
  )
}

/** Road width in meters from `width` / `est_width`, else a default by highway type */
export function roadWidthFromTags(tags: OsmTags): { meters: number; explicit: boolean } {
  const explicit = parseWidth(tags.width) ?? parseWidth(tags.est_width)
  if (explicit !== undefined) return { meters: explicit, explicit: true }

  const table = isOneway(tags) ? HIGHWAY_WIDTH_ONEWAY : HIGHWAY_WIDTH_NO_ONEWAY
  return { meters: (tags.highway && table[tags.highway]) || DEFAULT_FALLBACK, explicit: false }
}

/** Which part of the street `key` describes, or `undefined` if it is not a width key we draw */
export function widthTargetForKey(key: string): WidthTarget | undefined {
  if (WAY_WIDTH_KEYS.has(key)) return { kind: 'way' }

  const match = SIDE_WIDTH_KEY.exec(key)
  if (!match) return undefined

  const prefix = match[1] as 'cycleway' | 'sidewalk'
  const sides: WidthSide[] = match[2] === 'both' ? ['left', 'right'] : [match[2] as WidthSide]
  return { kind: 'side', prefix, sides }
}
