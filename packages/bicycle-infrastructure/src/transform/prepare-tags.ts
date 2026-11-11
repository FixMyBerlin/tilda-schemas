import { ALLOWED_HIGHWAYS } from '../helpers/highway-classes.ts'
import { containsSubstring } from '../helpers/strings.ts'
/**
 * Pre-categorization tag transforms, ported from tilda-geo
 * (processing/topics/roads_bikelanes/helper/transform_tags/*). These mutate the raw way
 * tags in-place BEFORE `getTransformedObjects`, exactly as `roads_bikelanes.lua` does.
 */
import type { OsmTags } from '../types.ts'

/** The access tags that signal a (construction/closure) restriction, per highway type. */
function restrictedAccessTags(tags: OsmTags): string[] {
  const restricted: string[] = []
  if (tags.access === 'no') restricted.push('access')
  if (tags.highway === 'cycleway' && tags.bicycle === 'no') restricted.push('bicycle')
  if (tags.highway === 'footway' && tags.foot === 'no') restricted.push('foot')
  return restricted
}

/** transform_lifecycle_tags.lua — `highway=construction` + `construction=<hw>` → real highway. */
export function transformLifecycleTags(tags: OsmTags): void {
  if (!tags.highway) return

  if (tags.construction != null && ALLOWED_HIGHWAYS.has(tags.construction)) {
    tags.highway = tags.construction
    tags.lifecycle = 'construction'
    tags.construction = undefined
  }

  // Construction-related access restrictions (access:reason/description/note mention construction).
  const constructionRestricted = restrictedAccessTags(tags)
  if (constructionRestricted.length > 0) {
    const text =
      `${tags['access:reason'] ?? ''} ${tags.description ?? ''} ${tags.note ?? ''}`.toLowerCase()
    if (containsSubstring(text, 'construction') || containsSubstring(text, 'baustelle')) {
      tags.lifecycle = 'construction_no_access'
      for (const t of constructionRestricted) tags[t] = undefined
    }
  }

  // Blocked / closure restrictions (description/note mention a closure term).
  const blockedTerms = [
    'sperrung',
    'gesperrt',
    'blockiert',
    'blocked',
    'closure',
    'closed',
    'blocked off',
  ]
  const blockedRestricted = restrictedAccessTags(tags)
  if (blockedRestricted.length > 0) {
    const text = `${tags.description ?? ''} ${tags.note ?? ''}`.toLowerCase()
    if (blockedTerms.some((term) => containsSubstring(text, term))) {
      tags.lifecycle = 'blocked'
      for (const t of blockedRestricted) tags[t] = undefined
    }
  }

  transformTemporary(tags)
}

const TEMPORARY_SIDE_PREFIXES = ['cycleway', 'sidewalk'].flatMap((prefix) =>
  ['', ':left', ':right', ':both'].map((infix) => `${prefix}${infix}`),
)

/**
 * `temporary=yes` → `lifecycle=temporary`, `cycleway:right:temporary=yes` →
 * `cycleway:right:lifecycle=temporary` (same for `sidewalk` and all sides). An existing lifecycle
 * wins; the `temporary` key is removed (transform_lifecycle_tags.lua, tilda-geo `08b1428b5`).
 */
function transformTemporary(tags: OsmTags): void {
  if (tags.temporary === 'yes') {
    tags.temporary = undefined
    tags.lifecycle ??= 'temporary'
  }
  for (const prefix of TEMPORARY_SIDE_PREFIXES) {
    if (tags[`${prefix}:temporary`] !== 'yes') continue
    tags[`${prefix}:temporary`] = undefined
    tags[`${prefix}:lifecycle`] ??= 'temporary'
  }
}

/**
 * Where the contraflow lane|track of a oneway road lies and which `cycleway:<side>:oneway` says
 * "against the road direction". `oneway=-1` flows against the way, so both are mirrored.
 * Mirrored `oneway=-1` and the explicit side direction as in tilda-geo `bac701775`.
 */
const CONTRAFLOW: Record<
  string,
  { side: 'left' | 'right'; otherSide: 'left' | 'right'; oneway: string }
> = {
  yes: { side: 'left', otherSide: 'right', oneway: '-1' },
  '-1': { side: 'right', otherSide: 'left', oneway: 'yes' },
}

const OPPOSITE_INFRASTRUCTURE: Record<string, string> = {
  opposite_lane: 'lane',
  opposite_track: 'track',
}

/** transform_cycleway_opposite_schema.lua — `cycleway=opposite*` → oneway schema. */
export function transformCyclewayOppositeSchema(tags: OsmTags): void {
  const direction = tags.oneway === undefined ? undefined : CONTRAFLOW[tags.oneway]
  if (direction === undefined) return

  if (tags.cycleway === 'opposite') {
    tags.cycleway = 'no'
    tags['oneway:bicycle'] = 'no'
    return
  }

  const infrastructure =
    tags.cycleway === undefined ? undefined : OPPOSITE_INFRASTRUCTURE[tags.cycleway]
  if (infrastructure !== undefined) {
    const sideKey = `cycleway:${direction.side}`
    const sideOnewayKey = `${sideKey}:oneway`
    tags.cycleway = undefined
    tags[`cycleway:${direction.otherSide}`] = 'no'
    tags[sideKey] = infrastructure
    // Explicit, because the default on a oneway road is "with the road direction" on both sides.
    tags[sideOnewayKey] = tags[sideOnewayKey] ?? direction.oneway
    tags['oneway:bicycle'] = 'no'
  }
}

/** transform_construction_prefix.lua — `construction:<tag>=v` → `<tag>=v` + lifecycle marker. */
export function transformConstructionPrefix(tags: OsmTags): void {
  const constructionKeys: Array<[string, string]> = []
  for (const key of Object.keys(tags)) {
    const value = tags[key]
    if (value !== undefined && key.startsWith('construction:')) constructionKeys.push([key, value])
  }
  for (const [key, value] of constructionKeys) {
    const baseTag = key.slice('construction:'.length)
    tags[baseTag] = value
    tags[key] = undefined
    // `construction:cycleway=lane` is the cycleway of the road, not the road: `cycleway:lifecycle`
    if (/^(cycleway|sidewalk)(:|$)/.test(baseTag)) {
      tags[`${baseTag}:lifecycle`] = 'construction'
    } else {
      tags.lifecycle = 'construction'
    }
  }
}

/** transform_cycleway_both_postfix.lua — `cycleway=no` (no side tags) → `cycleway:both=no`. */
export function transformCyclewayBothPostfix(tags: OsmTags): void {
  if (
    tags.cycleway === 'no' &&
    tags['cycleway:both'] == null &&
    tags['cycleway:left'] == null &&
    tags['cycleway:right'] == null
  ) {
    tags['cycleway:both'] = 'no'
    tags.cycleway = undefined
  }
}

// `1` and `true` mean `yes`: https://wiki.openstreetmap.org/wiki/Key:oneway
const ONEWAY_YES_ALIASES = new Set(['1', 'true'])
// A roundabout implies `oneway=yes`: https://wiki.openstreetmap.org/wiki/Tag:junction=roundabout
const ONEWAY_JUNCTIONS = new Set(['roundabout', 'circular'])
const ONEWAY_KEYS = (() => {
  const keys = ['oneway', 'oneway:bicycle']
  for (const prefix of ['cycleway', 'sidewalk']) {
    for (const infix of ['', ':left', ':right', ':both']) keys.push(`${prefix}${infix}:oneway`)
  }
  // `construction:*` tags become the main tags later (`transformConstructionPrefix`).
  return [...keys, ...keys.map((key) => `construction:${key}`)]
})()

/**
 * normalize_oneway_tags.lua — so that later steps only compare with `yes`, `-1` and `no`:
 * `1`/`true` become `yes`, and a roundabout without `oneway` gets `oneway=yes`.
 */
export function normalizeOnewayTags(tags: OsmTags): void {
  for (const key of ONEWAY_KEYS) {
    const value = tags[key]
    if (value !== undefined && ONEWAY_YES_ALIASES.has(value)) tags[key] = 'yes'
  }
  if (
    tags.oneway === undefined &&
    tags.junction !== undefined &&
    ONEWAY_JUNCTIONS.has(tags.junction)
  ) {
    tags.oneway = 'yes'
  }
}

/** Apply all pre-transforms in the same order as roads_bikelanes_ways.lua. */
export function prepareTags(tags: OsmTags): void {
  transformLifecycleTags(tags)
  normalizeOnewayTags(tags)
  transformCyclewayOppositeSchema(tags)
  transformConstructionPrefix(tags)
  transformCyclewayBothPostfix(tags)
}
