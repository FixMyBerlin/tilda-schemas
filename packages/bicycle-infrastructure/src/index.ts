import { categorizeBikelane } from './categories/bikelane-categories.ts'
import { deriveOneway } from './derive/derive-oneway.ts'
import { deriveBikelaneSmoothness } from './derive/derive-smoothness.ts'
import { deriveBikelaneSurface } from './derive/derive-surface.ts'
import { deriveTrafficMode } from './derive/derive-traffic-mode.ts'
import { deriveTrafficSigns } from './derive/derive-traffic-signs.ts'
import { parseLength } from './helpers/parse-length.ts'
import { separation, marking, buffer, surfaceColor } from './sanitize/sanitize-road-tags.ts'
import { prepareTags } from './transform/prepare-tags.ts'
import { getTransformedObjects, BIKELANE_TRANSFORMATIONS } from './transform/transformations.ts'
/**
 * TypeScript port of Tilda's LUA bicycle-infrastructure processing.
 *
 * `processBikelanes(tags)` mirrors `bikelanes.lua`: it transforms one OSM way into its
 * self + side geometries, categorizes each, and derives the key result fields.
 * Only the category + a focused set of fields (surface, smoothness, oneway, separation,
 * buffer, marking, traffic_mode, traffic_sign, surface_color, width) are produced — these
 * cover the project's focus (Radinfrastrukturkategorie + Oberfläche + Protektion).
 *
 * Input is a plain OSM tag object (e.g. one Overpass `way.tags`). Disallowed sanitizer
 * values are normalized to `null` to match Tilda's exported GeoJSON.
 */
import type { BikelaneResult, OsmTags } from './types.ts'
import { DISALLOWED } from './types.ts'

/** Sanitizer output → exported value: DISALLOWED and undefined both become null. */
function clean<T>(value: T | undefined | typeof DISALLOWED): T | null {
  return value == null || value === DISALLOWED ? null : value
}

export function processBikelanes(objectTags: OsmTags): BikelaneResult[] {
  const results: BikelaneResult[] = []
  // Clone so the caller's tags are never mutated, then run the pre-categorization
  // transforms (lifecycle, cycleway=opposite/no schema fixes) just like roads_bikelanes.lua.
  const tags: OsmTags = { ...objectTags }
  prepareTags(tags)
  const transformed = getTransformedObjects(tags, BIKELANE_TRANSFORMATIONS)

  for (const t of transformed) {
    t._length = tags._length
    const category = categorizeBikelane(t)
    if (category == null) continue

    const result: BikelaneResult = {
      _side: t._side ?? 'self',
      _prefix: t._prefix ?? null,
      _infrastructureExists: category.infrastructureExists,
      category: category.id,
    }

    if (category.infrastructureExists) {
      result.oneway = deriveOneway(t, category)
      result.width = parseLength(t.width) ?? null
      result.surface_color = clean(surfaceColor(t))
      result.separation_left = clean(separation(t, 'left'))
      result.separation_right = clean(separation(t, 'right'))
      result.buffer_left = clean(buffer(t, 'left'))
      result.buffer_right = clean(buffer(t, 'right'))
      result.marking_left = clean(marking(t, 'left'))
      result.marking_right = clean(marking(t, 'right'))

      const tm = deriveTrafficMode(t, t._parent ?? tags, category.id, t._side ?? 'self')
      result.traffic_mode_left = tm.traffic_mode_left ?? null
      result.traffic_mode_right = tm.traffic_mode_right ?? null

      const ts = deriveTrafficSigns(t)
      result.traffic_sign = ts.traffic_sign ?? null

      const surf = deriveBikelaneSurface(t, category)
      result.surface = surf.surface ?? null
      result.surface_source = surf.surface_source ?? null
      result.surface_confidence = surf.surface_confidence ?? null

      const smooth = deriveBikelaneSmoothness(t, category)
      result.smoothness = smooth.smoothness ?? null
      result.smoothness_source = smooth.smoothness_source ?? null
      result.smoothness_confidence = smooth.smoothness_confidence ?? null
    }

    results.push(result)
  }

  return results
}

export type { BikelaneResult, OsmTags } from './types.ts'
export { categorizeBikelane, CATEGORY_DEFINITIONS } from './categories/bikelane-categories.ts'
export { analyzeCategoryGaps } from './categories/analyze-category-gaps.ts'
export type { CategoryGap, CategoryGapResult } from './categories/analyze-category-gaps.ts'
export {
  listTargetCategories,
  planTagsForCategory,
  writeKeyForSide,
  UnknownTargetCategoryError,
} from './categories/plan-tags-for-category.ts'
export type {
  CategoryTagPlan,
  ListTargetCategoriesOptions,
  PlanTagsForCategoryOptions,
  TagChangeEntry,
  TagConflictEntry,
  TagPlanEntry,
} from './categories/plan-tags-for-category.ts'
export {
  CATEGORY_SPECS,
  isIncompleteCategoryId,
  specsWithGapDiscriminators,
} from './categories/category-specs.ts'
export type { CategorySpec, GapDiscriminator } from './categories/category-specs.ts'
export { getTransformedObjects, BIKELANE_TRANSFORMATIONS } from './transform/transformations.ts'
export { prepareTags } from './transform/prepare-tags.ts'
// The highway taxonomy is part of the public domain model (ported from highway_classes.lua).
// Re-exported so downstream tools (e.g. the Overpass query builder) use one source of truth.
export {
  TRUNK_MOTORWAY_CLASSES,
  MAJOR_ROAD_CLASSES,
  MINOR_ROAD_CLASSES,
  PATH_CLASSES,
  SIDEPATH_HIGHWAY_CLASSES,
  ALLOWED_HIGHWAYS,
} from './helpers/highway-classes.ts'
