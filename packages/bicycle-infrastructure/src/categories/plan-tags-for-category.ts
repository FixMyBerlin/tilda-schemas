import { prepareTags } from '../transform/prepare-tags.ts'
import { getTransformedObjects, BIKELANE_TRANSFORMATIONS } from '../transform/transformations.ts'
/**
 * Plan OSM tag adds/changes to reach a target bikelane category.
 * Works in transformed tag space internally; returns nested OSM keys for left/right
 * cycleway (and sidewalk) sides, bare keys for self.
 */
import type { BikelaneResult, OsmTags } from '../types.ts'
import { categorizeBikelane } from './bikelane-categories.ts'
import { CATEGORY_DEFINITIONS } from './bikelane-categories.ts'
import {
  CATEGORY_SPECS,
  isIncompleteCategoryId,
  specByCategoryId,
  type CategorySpec,
  type GapDiscriminator,
  type RefiningChild,
} from './category-specs.ts'
import { type TagPredicate } from './tag-predicate.ts'

export interface TagPlanEntry {
  key: string
  value: string
  reason: string
}

export interface TagChangeEntry {
  key: string
  from: string
  to: string
  reason: string
}

export interface TagConflictEntry {
  key: string
  value: string
  reason: string
}

export interface CategoryTagPlan {
  targetCategoryId: string
  currentCategoryId: string | null
  aligned: boolean
  add: TagPlanEntry[]
  change: TagChangeEntry[]
  conflicts: TagConflictEntry[]
}

export interface ListTargetCategoriesOptions {
  /** Current category id — unlock candidates from its gapDiscriminators are listed first. */
  fromCategory?: string
  /** When true with `fromCategory`, treat it as incomplete even if the id looks complete. */
  fromIncomplete?: boolean
}

interface TagRequirement {
  key: string
  values: string[]
  reason: string
}

function isPreciseTargetCategoryId(id: string): boolean {
  const def = CATEGORY_DEFINITIONS.find((c) => c.id === id)
  return def != null && def.infrastructureExists && !isIncompleteCategoryId(id)
}

function resolveUnlockCategory(
  baseId: string,
  unlocksCategory: string | undefined,
): string | undefined {
  if (unlocksCategory == null) return undefined
  if (unlocksCategory.startsWith('_')) return `${baseId}${unlocksCategory}`
  return unlocksCategory
}

function baseIdFromIncomplete(categoryId: string): string {
  return categoryId.replace(/_adjoiningOrIsolated$/, '').replace(/_advisoryOrExclusive$/, '')
}

function resolveRefinedIdFromSpec(spec: CategorySpec, idSuffix: string): string {
  if (idSuffix === '_advisoryOrExclusive' && spec.id.endsWith('_advisoryOrExclusive')) {
    return spec.id
  }
  const base = spec.id.replace(/_advisoryOrExclusive$/, '')
  return `${base}${idSuffix}`
}

function findTransformedTags(wayTags: OsmTags, side: BikelaneResult['_side']): OsmTags | undefined {
  const tags: OsmTags = { ...wayTags }
  prepareTags(tags)
  const transformed = getTransformedObjects(tags, BIKELANE_TRANSFORMATIONS)
  return transformed.find((t) => (t._side ?? 'self') === side)
}

function categorizeSide(wayTags: OsmTags, side: BikelaneResult['_side']): string | null {
  const transformed = findTransformedTags(wayTags, side)
  if (!transformed) return null
  const category = categorizeBikelane(transformed)
  return category?.id ?? null
}

/**
 * Map a transformed tag key back to OSM way tags for writing.
 * Left/right cycleway (and sidewalk) sub-objects use nested keys (`cycleway:right:lane`).
 */
export function writeKeyForSide(
  transformedKey: string,
  side: BikelaneResult['_side'],
  prefix: string | null,
): string {
  if (side === 'self' || prefix == null) return transformedKey
  if (prefix === 'cycleway' || prefix === 'sidewalk') {
    return `${prefix}:${side}:${transformedKey}`
  }
  return transformedKey
}

function tagValue(tags: OsmTags, key: string): string | undefined {
  return tags[key]
}

function positiveMatchScore(tags: OsmTags, predicate: TagPredicate): number {
  switch (predicate.op) {
    case 'eq':
      return tagValue(tags, predicate.key) === predicate.value ? 1 : 0
    case 'in': {
      const v = tagValue(tags, predicate.key)
      return v != null && predicate.values.includes(v) ? 1 : 0
    }
    case 'and':
      return predicate.predicates.reduce((sum, p) => sum + positiveMatchScore(tags, p), 0)
    case 'or':
      return Math.max(0, ...predicate.predicates.map((p) => positiveMatchScore(tags, p)))
    default:
      return 0
  }
}

function countEqInLeaves(predicate: TagPredicate): number {
  switch (predicate.op) {
    case 'eq':
    case 'in':
      return 1
    case 'and':
      return predicate.predicates.reduce((sum, p) => sum + countEqInLeaves(p), 0)
    case 'or':
      return Math.max(0, ...predicate.predicates.map((p) => countEqInLeaves(p)))
    default:
      return 0
  }
}

function pickOrBranch(tags: OsmTags, predicates: TagPredicate[]): TagPredicate | undefined {
  let best: TagPredicate | undefined
  let bestScore = -1
  let bestLeaves = -1
  for (const child of predicates) {
    const score = positiveMatchScore(tags, child)
    const leaves = countEqInLeaves(child)
    if (score > bestScore || (score === bestScore && leaves > bestLeaves)) {
      bestScore = score
      bestLeaves = leaves
      best = child
    }
  }
  return best
}

/**
 * Preferred tag atoms for macros that classification matches imperatively.
 * Without these, planTagsForCategory cannot invert the macro and emits only a
 * cryptic `_category` conflict.
 */
const MACRO_PLAN_REQUIREMENTS: Record<string, TagRequirement[]> = {
  bicycle_road_base: [
    { key: 'bicycle_road', values: ['yes'], reason: 'Fahrradstraße / bicycle road' },
  ],
  bicycle_road_vehicle_destination: [
    { key: 'bicycle_road', values: ['yes'], reason: 'Fahrradstraße / bicycle road' },
    {
      key: 'vehicle',
      values: ['destination'],
      reason: 'Motor vehicles only for destination traffic (Anlieger frei)',
    },
  ],
}

function collectFromPredicate(
  predicate: TagPredicate,
  tags: OsmTags,
  reason: string,
  out: TagRequirement[],
): void {
  switch (predicate.op) {
    case 'eq':
      out.push({ key: predicate.key, values: [predicate.value], reason })
      return
    case 'in':
      out.push({ key: predicate.key, values: [...predicate.values], reason })
      return
    case 'and':
      for (const child of predicate.predicates) {
        collectFromPredicate(child, tags, reason, out)
      }
      return
    case 'or': {
      const best = pickOrBranch(tags, predicate.predicates)
      if (best) collectFromPredicate(best, tags, reason, out)
      return
    }
    case 'macro': {
      const requirements = MACRO_PLAN_REQUIREMENTS[predicate.name]
      if (requirements) {
        for (const req of requirements) {
          out.push({ ...req, values: [...req.values] })
        }
      }
      return
    }
    case 'literal':
    case 'exists':
    case 'notExists':
    case 'neq':
    case 'notIn':
    case 'includes':
    case 'hasPrefix':
    case 'hasSuffix':
    case 'hasTagWithPrefix':
    case 'not':
      return
    default:
      return
  }
}

function discriminatorBaseId(targetCategoryId: string): string {
  return targetCategoryId
    .replace(/_adjoining$/, '')
    .replace(/_isolated$/, '')
    .replace(/_advisory$/, '')
    .replace(/_exclusive$/, '')
}

function findParentSpecAndRefining(targetCategoryId: string):
  | {
      parent: CategorySpec
      refining?: RefiningChild
    }
  | undefined {
  for (const parent of CATEGORY_SPECS) {
    if (parent.id === targetCategoryId) return { parent }
    const refining = parent.refining?.find(
      (child) => resolveRefinedIdFromSpec(parent, child.idSuffix) === targetCategoryId,
    )
    if (refining) return { parent, refining }
  }
  return undefined
}

function discriminatorsForTarget(
  parent: CategorySpec,
  targetCategoryId: string,
): GapDiscriminator[] {
  if (!parent.gapDiscriminators?.length) return []
  const baseId = discriminatorBaseId(targetCategoryId)
  return parent.gapDiscriminators.filter((d) => {
    const unlocked = resolveUnlockCategory(baseId, d.unlocksCategory)
    return unlocked === targetCategoryId
  })
}

function requirementsFromSpec(targetCategoryId: string, tags: OsmTags): TagRequirement[] {
  const resolved = findParentSpecAndRefining(targetCategoryId)
  if (!resolved) return []

  const { parent, refining } = resolved
  const requirements: TagRequirement[] = []

  if (parent.match) {
    collectFromPredicate(parent.match, tags, `Required for ${targetCategoryId}`, requirements)
  }

  if (refining) {
    collectFromPredicate(
      refining.match,
      tags,
      `Discriminator for ${targetCategoryId}`,
      requirements,
    )
  }

  for (const disc of discriminatorsForTarget(parent, targetCategoryId)) {
    for (const value of disc.values) {
      requirements.push({
        key: disc.key,
        values: [value],
        reason: disc.reason,
      })
    }
  }

  const needsClarificationSpec = CATEGORY_SPECS.find((s) => s.id === 'needsClarification')
  const baseForTarget = discriminatorBaseId(targetCategoryId)
  if (needsClarificationSpec?.gapDiscriminators) {
    for (const disc of needsClarificationSpec.gapDiscriminators) {
      const unlocked = resolveUnlockCategory('', disc.unlocksCategory)
      if (unlocked !== baseForTarget && unlocked !== targetCategoryId) continue
      for (const value of disc.values) {
        requirements.push({
          key: disc.key,
          values: [value],
          reason: disc.reason,
        })
      }
    }
  }

  return requirements
}

function dedupeRequirements(requirements: TagRequirement[]): TagRequirement[] {
  const byKey = new Map<string, TagRequirement>()
  for (const req of requirements) {
    const existing = byKey.get(req.key)
    if (!existing) {
      byKey.set(req.key, { ...req, values: [...req.values] })
      continue
    }
    const values = new Set([...existing.values, ...req.values])
    byKey.set(req.key, { ...existing, values: [...values], reason: existing.reason || req.reason })
  }
  return [...byKey.values()]
}

function applyPlanToWayTags(
  wayTags: OsmTags,
  add: TagPlanEntry[],
  change: TagChangeEntry[],
): OsmTags {
  const next: OsmTags = { ...wayTags }
  for (const entry of change) {
    next[entry.key] = entry.to
  }
  for (const entry of add) {
    if (next[entry.key] == null) next[entry.key] = entry.value
  }
  return next
}

function trafficSignSatisfied(tags: OsmTags, value: string): boolean {
  return tags.traffic_sign?.includes(value) === true
}

function pickPreferredValue(req: TagRequirement, tags: OsmTags): string {
  if (req.key === 'traffic_sign') {
    return req.values[0]!
  }
  const current = tagValue(tags, req.key)
  if (current != null && req.values.includes(current)) return current
  return req.values[0]!
}

export function listTargetCategories(options?: ListTargetCategoriesOptions): string[] {
  const all = CATEGORY_DEFINITIONS.map((c) => c.id).filter(isPreciseTargetCategoryId)

  const fromCategory = options?.fromCategory
  if (!fromCategory) return all

  const spec = specByCategoryId(fromCategory)
  const incomplete = options.fromIncomplete ?? isIncompleteCategoryId(fromCategory)
  if (!spec || !incomplete || !spec.gapDiscriminators?.length) return all

  const baseId = baseIdFromIncomplete(fromCategory)
  const prioritized: string[] = []
  const seen = new Set<string>()

  for (const disc of spec.gapDiscriminators) {
    const unlocked = resolveUnlockCategory(baseId, disc.unlocksCategory)
    if (unlocked == null || seen.has(unlocked)) continue
    if (!isPreciseTargetCategoryId(unlocked)) continue
    seen.add(unlocked)
    prioritized.push(unlocked)
  }

  for (const id of all) {
    if (!seen.has(id)) prioritized.push(id)
  }
  return prioritized
}

export interface PlanTagsForCategoryOptions {
  side?: BikelaneResult['_side']
}

export class UnknownTargetCategoryError extends Error {
  constructor(public readonly targetCategoryId: string) {
    super(`Unknown target category: ${targetCategoryId}`)
    this.name = 'UnknownTargetCategoryError'
  }
}

/**
 * Plan tag adds/changes to reach `targetCategoryId` for the given way and side.
 *
 * Returned keys use nested OSM form for left/right cycleway (and sidewalk) sides
 * (`cycleway:right:lane`); bare keys for self-side objects.
 *
 * Most predicate macros are not inverted; a small set (`bicycle_road_*`) has
 * preferred tag requirements. Remaining macros may still yield a `_category` conflict.
 */
export function planTagsForCategory(
  wayTags: OsmTags,
  targetCategoryId: string,
  options?: PlanTagsForCategoryOptions,
): CategoryTagPlan {
  const spec = specByCategoryId(targetCategoryId)
  if (!spec) {
    throw new UnknownTargetCategoryError(targetCategoryId)
  }

  const side = options?.side ?? 'self'
  const transformed = findTransformedTags(wayTags, side)
  const prefix = transformed?._prefix ?? null
  const currentCategoryId = categorizeSide(wayTags, side)
  const tags = transformed ?? wayTags

  if (currentCategoryId === targetCategoryId) {
    return {
      targetCategoryId,
      currentCategoryId,
      aligned: true,
      add: [],
      change: [],
      conflicts: [],
    }
  }

  const requirements = dedupeRequirements(requirementsFromSpec(targetCategoryId, tags))
  const add: TagPlanEntry[] = []
  const change: TagChangeEntry[] = []
  const conflicts: TagConflictEntry[] = []

  for (const req of requirements) {
    const writeKey = writeKeyForSide(req.key, side, prefix)
    const wayValue = wayTags[writeKey] ?? tags[req.key]
    const transformedValue = tags[req.key]

    if (req.key === 'traffic_sign') {
      const satisfied = req.values.some((v) => trafficSignSatisfied(tags, v))
      if (satisfied) continue
      const preferred = pickPreferredValue(req, tags)
      if (wayValue == null && transformedValue == null) {
        add.push({ key: writeKey, value: preferred, reason: req.reason })
      } else if (
        transformedValue != null &&
        !req.values.some((v) => transformedValue.includes(v))
      ) {
        change.push({
          key: writeKey,
          from: wayValue ?? transformedValue,
          to: preferred,
          reason: req.reason,
        })
      }
      continue
    }

    if (transformedValue != null && !req.values.includes(transformedValue)) {
      change.push({
        key: writeKey,
        from: wayValue ?? transformedValue,
        to: pickPreferredValue(req, tags),
        reason: req.reason,
      })
      continue
    }

    if (transformedValue == null && wayValue == null) {
      add.push({
        key: writeKey,
        value: pickPreferredValue(req, tags),
        reason: req.reason,
      })
    }
  }

  const dryRunTags = applyPlanToWayTags(wayTags, add, change)
  const resultCategory = categorizeSide(dryRunTags, side)
  const aligned = resultCategory === targetCategoryId

  if (!aligned) {
    const suggested =
      add.length > 0 || change.length > 0
        ? 'Suggested tag edits are not enough to reach that classification.'
        : 'No automatic tag edits could be derived for this category (often because it matches via a complex macro).'
    conflicts.push({
      key: '_category',
      value: resultCategory ?? 'null',
      reason: `${suggested} Target “${targetCategoryId}” would still classify as ${resultCategory ?? 'none'}.`,
    })
  }

  return {
    targetCategoryId,
    currentCategoryId,
    aligned,
    add,
    change,
    conflicts,
  }
}
