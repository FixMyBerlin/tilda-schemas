import { parseWidth } from '@tilda-geo/bicycle-infrastructure'
import { pathRole } from '../path-role.ts'
import type { OsmTags } from '../types.ts'

/**
 * A foot and cycle path with a width per part: `cycleway:width` and `footway:width` next to `width`
 * (the whole way). Which part widths a mapper must tag is decided by the requirement engine; this
 * only says when the part fields make sense and whether the numbers add up.
 *
 * Rules, from `pathRole`: part widths exist only with `segregated=yes`. With `segregated=no`
 * there is only `width`. A cycleway whose footway is a line of its own has no part widths either;
 * its `width` is the cycleway width.
 */

export const PART_WIDTH_KEYS = ['cycleway:width', 'footway:width'] as const
export type PartWidthKey = (typeof PART_WIDTH_KEYS)[number]

export interface PartWidthOptions {
  /** meters: `width` may differ from the sum of the parts by rounding. Default 0.05. */
  toleranceMeters?: number
}

const DEFAULT_TOLERANCE = 0.05

/**
 * - `always`: the part widths are shown (`segregated=yes`, or a part width is tagged)
 * - `optional`: one way for walking and cycling without `segregated`; the parts can be shown with a button
 * - `undefined`: no parts
 */
export function partWidthMode(tags: OsmTags, category?: string): 'always' | 'optional' | undefined {
  if (PART_WIDTH_KEYS.some((key) => tags[key] !== undefined)) return 'always'
  const role = pathRole(tags, { category })
  if (role.style !== 'oneLine') return undefined
  if (role.segregated === true) return 'always'
  if (role.segregated === false) return undefined
  return 'optional'
}

export type PartWidthMismatch = {
  width: number
  parts: { key: PartWidthKey; meters: number }[]
  sum: number
}

/** `width` and both part widths are tagged and `width` is not their sum; else undefined */
export function partWidthMismatch(
  tags: OsmTags,
  options: PartWidthOptions = {},
): PartWidthMismatch | undefined {
  const tolerance = options.toleranceMeters ?? DEFAULT_TOLERANCE
  const width = parseWidth(tags.width)
  if (width === undefined) return undefined
  const parts = PART_WIDTH_KEYS.map((key) => ({ key, meters: parseWidth(tags[key]) }))
  // one part alone says nothing about the whole
  if (parts.some((part) => part.meters === undefined)) return undefined
  const sum = parts.reduce((total, part) => total + part.meters!, 0)
  if (Math.abs(sum - width) <= tolerance) return undefined
  return { width, parts: parts as PartWidthMismatch['parts'], sum: Math.round(sum * 100) / 100 }
}

/** Meters as an OSM value: `4.5`, not `4.50` */
export function formatMeters(meters: number): string {
  return String(Math.round(meters * 100) / 100)
}

export type PartWidthWholeWay = { key: PartWidthKey; meters: number; width: number }

/** Highways that can be a way of its own for walking and cycling (with part widths) */
export const PATH_HIGHWAYS: ReadonlySet<string> = new Set([
  'path',
  'cycleway',
  'footway',
  'bridleway',
])

/**
 * A part (`cycleway:width` or `footway:width`) of a foot and cycle path is as wide as the whole
 * way (or wider): nothing would be left for the other part. Usually the width of the whole way
 * was copied into the part, or the way is no shared path. Undefined otherwise.
 */
export function partWidthWholeWay(
  tags: OsmTags,
  options: PartWidthOptions = {},
): PartWidthWholeWay | undefined {
  const tolerance = options.toleranceMeters ?? DEFAULT_TOLERANCE
  if (!PATH_HIGHWAYS.has(tags.highway ?? '')) return undefined
  const width = parseWidth(tags.width)
  if (width === undefined) return undefined
  for (const key of PART_WIDTH_KEYS) {
    const meters = parseWidth(tags[key])
    if (meters !== undefined && meters >= width - tolerance) return { key, meters, width }
  }
  return undefined
}

/**
 * The general source wins: `source:cycleway:width` (and `source:footway:width`) is not stored when
 * it says the same as `source:width`. Returns the tags without those keys (a new object when
 * something was dropped).
 */
export function withoutRedundantPartSources(tags: OsmTags): OsmTags {
  const general = tags['source:width']
  if (!general) return tags
  const redundant = PART_WIDTH_KEYS.map((key) => `source:${key}`).filter(
    (key) => tags[key] === general,
  )
  if (!redundant.length) return tags
  const result = { ...tags }
  for (const key of redundant) delete result[key]
  return result
}

/** The part source keys that `withoutRedundantPartSources` drops, as an update (`undefined` values) */
export function redundantPartSourceUpdate(tags: OsmTags): Record<string, undefined> {
  const kept = withoutRedundantPartSources(tags)
  const update: Record<string, undefined> = {}
  for (const key of Object.keys(tags)) {
    if (!(key in kept)) update[key] = undefined
  }
  return update
}

/** The general source a part source inherits: `source:width` for `source:cycleway:width` */
export function inheritedPartSource(key: string, tags: OsmTags): string | undefined {
  if (!PART_WIDTH_KEYS.some((part) => key === `source:${part}`)) return undefined
  return tags[key] ? undefined : tags['source:width']
}
