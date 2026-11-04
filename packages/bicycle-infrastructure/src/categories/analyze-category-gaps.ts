import { prepareTags } from '../transform/prepare-tags.ts'
import { getTransformedObjects, BIKELANE_TRANSFORMATIONS } from '../transform/transformations.ts'
/**
 * Analyze which discriminating tags are missing for incomplete bikelane categories.
 * Derived from the same declarative specs used for classification.
 */
import type { BikelaneResult, OsmTags } from '../types.ts'
import { categoryIsSidepath } from './category-is-sidepath.ts'
import {
  isIncompleteCategoryId,
  specByCategoryId,
  type CategorySpec,
  type GapDiscriminator,
} from './category-specs.ts'
import { laneDiscriminatorKnown, sidepathDiscriminatorKnown } from './compile-category-specs.ts'

export interface CategoryGap {
  key: string
  values: string[]
  unlocksCategory?: string
  reason: string
}

export interface CategoryGapResult {
  category: string
  _side: BikelaneResult['_side']
  incomplete: boolean
  missing: CategoryGap[]
}

function baseIdFromIncomplete(categoryId: string): string {
  return categoryId.replace(/_adjoiningOrIsolated$/, '').replace(/_advisoryOrExclusive$/, '')
}

function discriminatorSatisfied(disc: GapDiscriminator, tags: OsmTags): boolean {
  return disc.values.some((v) => {
    if (disc.key === 'traffic_sign') return tags.traffic_sign?.includes(v) === true
    return tags[disc.key] === v
  })
}

function gapDiscriminatorsResolved(spec: CategorySpec, tags: OsmTags): boolean {
  const keys = new Set(spec.gapDiscriminators?.map((d) => d.key) ?? [])
  if (keys.has('is_sidepath') && (sidepathDiscriminatorKnown(tags) || categoryIsSidepath(tags))) {
    return true
  }
  if (keys.has('lane') && laneDiscriminatorKnown(tags)) {
    return true
  }
  return false
}

function resolveUnlockCategory(
  baseId: string,
  unlocksCategory: string | undefined,
): string | undefined {
  if (unlocksCategory == null) return undefined
  if (unlocksCategory.startsWith('_')) return `${baseId}${unlocksCategory}`
  return unlocksCategory
}

function gapsFromSpec(spec: CategorySpec, categoryId: string, tags: OsmTags): CategoryGap[] {
  if (!spec.gapDiscriminators?.length) return []
  if (gapDiscriminatorsResolved(spec, tags)) return []

  const baseId = baseIdFromIncomplete(categoryId)
  return spec.gapDiscriminators
    .filter((d) => !discriminatorSatisfied(d, tags))
    .map((d) => ({
      key: d.key,
      values: [...d.values],
      reason: d.reason,
      unlocksCategory: resolveUnlockCategory(baseId, d.unlocksCategory),
    }))
}

function gapsForIncomplete(categoryId: string, tags: OsmTags): CategoryGap[] {
  const spec = specByCategoryId(categoryId)
  if (!spec) return []
  return gapsFromSpec(spec, categoryId, tags)
}

function findTransformedTags(wayTags: OsmTags, result: BikelaneResult): OsmTags | undefined {
  const tags: OsmTags = { ...wayTags }
  prepareTags(tags)
  const transformed = getTransformedObjects(tags, BIKELANE_TRANSFORMATIONS)
  return transformed.find(
    (t) => (t._side ?? 'self') === result._side && (t._prefix ?? null) === result._prefix,
  )
}

export function analyzeCategoryGaps(
  wayTags: OsmTags,
  results: BikelaneResult[],
): CategoryGapResult[] {
  return results.map((result) => {
    const incomplete = isIncompleteCategoryId(result.category)
    const transformed = findTransformedTags(wayTags, result) ?? wayTags
    const missing = incomplete ? gapsForIncomplete(result.category, transformed) : []
    return {
      category: result.category,
      _side: result._side,
      incomplete,
      missing,
    }
  })
}
