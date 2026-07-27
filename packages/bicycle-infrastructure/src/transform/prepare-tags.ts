/**
 * Pre-categorization tag transforms, ported from tilda-geo
 * (processing/topics/roads_bikelanes/helper/transform_tags/*). These mutate the raw way
 * tags in-place BEFORE `getTransformedObjects`, exactly as `roads_bikelanes.lua` does.
 */
import type { OsmTags } from '../types.ts'
import { containsSubstring } from '../helpers/strings.ts'
import { ALLOWED_HIGHWAYS } from '../helpers/highway-classes.ts'

function toSemicolonList(parts: Array<string | undefined>): string {
  return parts.filter((p) => p != null && p !== '').join('; ')
}

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
    const text = `${tags['access:reason'] ?? ''} ${tags.description ?? ''} ${tags.note ?? ''}`.toLowerCase()
    if (containsSubstring(text, 'construction') || containsSubstring(text, 'baustelle')) {
      tags.lifecycle = 'construction_no_access'
      tags.description = toSemicolonList([tags.description, 'TILDA-Hinweis: Weg gesperrt aufgrund einer Baustelle.'])
      for (const t of constructionRestricted) tags[t] = undefined
    }
  }

  // Blocked / closure restrictions (description/note mention a closure term).
  const blockedTerms = ['sperrung', 'gesperrt', 'blockiert', 'blocked', 'closure', 'closed', 'blocked off']
  const blockedRestricted = restrictedAccessTags(tags)
  if (blockedRestricted.length > 0) {
    const text = `${tags.description ?? ''} ${tags.note ?? ''}`.toLowerCase()
    if (blockedTerms.some((term) => containsSubstring(text, term))) {
      tags.lifecycle = 'blocked'
      tags.description = toSemicolonList([tags.description, 'TILDA-Hinweis: Weg gesperrt (Sperrung).'])
      for (const t of blockedRestricted) tags[t] = undefined
    }
  }
}

/** transform_cycleway_opposite_schema.lua — `cycleway=opposite*` → oneway schema. */
export function transformCyclewayOppositeSchema(tags: OsmTags): void {
  if (tags.oneway !== 'yes') return

  if (tags.cycleway === 'opposite') {
    tags.cycleway = 'no'
    tags['oneway:bicycle'] = 'no'
    return
  }
  if (tags.cycleway === 'opposite_lane') {
    tags.cycleway = undefined
    tags['cycleway:right'] = 'no'
    tags['cycleway:left'] = 'lane'
    tags['oneway:bicycle'] = 'no'
    return
  }
  if (tags.cycleway === 'opposite_track') {
    tags.cycleway = undefined
    tags['cycleway:right'] = 'no'
    tags['cycleway:left'] = 'track'
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
    if (baseTag.startsWith('cycleway:') || baseTag.startsWith('sidewalk:')) {
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

/** Apply all pre-transforms in the same order as roads_bikelanes.lua. */
export function prepareTags(tags: OsmTags): void {
  transformLifecycleTags(tags)
  transformCyclewayOppositeSchema(tags)
  transformConstructionPrefix(tags)
  transformCyclewayBothPostfix(tags)
}
