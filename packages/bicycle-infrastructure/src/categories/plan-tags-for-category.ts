import { containsSubstring, hasPrefix } from '../helpers/strings.ts'
import { PROTECTIVE_SEPARATION } from '../sanitize/sanitize-road-tags.ts'
import { prepareTags } from '../transform/prepare-tags.ts'
import { getTransformedObjects, BIKELANE_TRANSFORMATIONS } from '../transform/transformations.ts'
/**
 * Plan OSM tag adds/changes to reach a target bikelane category.
 * Works in transformed tag space internally; returns nested OSM keys for left/right
 * cycleway (and sidewalk) sides, bare keys for self.
 *
 * The planner reads the same category specs the classifier uses. The match predicate of the
 * target (and of its refining child, e.g. `_adjoining`) is expanded into alternatives: each
 * alternative is a set of tags that is enough on its own (`segregated=yes` + `bicycle` + `foot`,
 * or `traffic_sign=DE:241`). Every alternative becomes a candidate plan; the planner classifies the
 * planned tags and keeps the cheapest candidate that gives the target.
 */
import type { BikelaneResult, OsmTags } from '../types.ts'
import { categorizeBikelane } from './bikelane-categories.ts'
import { CATEGORY_DEFINITIONS } from './bikelane-categories.ts'
import {
  CATEGORY_SPECS,
  isIncompleteCategoryId,
  specByCategoryId,
  type CategorySpec,
  type RefiningChild,
} from './category-specs.ts'
import { type TagPredicate } from './tag-predicate.ts'

/**
 * Why a tag is planned: `reason` is an English sentence, `reasonCode` a stable code for apps that
 * write their own text (for example `required_for_category`), `reasonParams` fills its placeholders.
 * The codes are listed in `TAG_REASON_CODES`.
 */
export interface TagReason {
  reason: string
  reasonCode: TagReasonCode
  reasonParams?: Record<string, string>
}

export interface TagPlanEntry extends TagReason {
  key: string
  value: string
}

export interface TagChangeEntry extends TagReason {
  key: string
  from: string
  to: string
}

export interface TagConflictEntry extends TagReason {
  key: string
  value: string
}

export interface CategoryTagPlan {
  targetCategoryId: string
  currentCategoryId: string | null
  aligned: boolean
  add: TagPlanEntry[]
  change: TagChangeEntry[]
  /** Keys to delete: `cycleway:both` (or `cycleway`) when a road side is split from the other */
  remove: string[]
  conflicts: TagConflictEntry[]
}

/**
 * `default`: the cheapest plan, the one `planTagsForCategory` returns.
 * `with_sign`: reaches the target with the traffic sign of the category (DE:240, DE:241, ...).
 * `without_sign`: reaches the target with `traffic_sign=none` and the tags that say the same.
 */
export type CategoryTagPlanVariantId = 'default' | 'with_sign' | 'without_sign'

export interface CategoryTagPlanVariant extends CategoryTagPlan {
  variantId: CategoryTagPlanVariantId
}

export interface ListTargetCategoriesOptions {
  /** Current category id — unlock candidates from its gapDiscriminators are listed first. */
  fromCategory?: string
  /** When true with `fromCategory`, treat it as incomplete even if the id looks complete. */
  fromIncomplete?: boolean
}

/** The codes of `TagReason.reasonCode`; `{x}` names a parameter. */
export const TAG_REASON_CODES = [
  /** `{category}`: a tag the category needs */
  'required_for_category',
  /** `{category}`: a tag that tells the refined category apart */
  'discriminator_for_category',
  'fixed_by_mapping_target',
  'bicycle_road',
  'bicycle_road_sign',
  'vehicle_destination',
  'bicycle_road_sign_vehicle_destination',
  'unsigned_cycleway',
  'unsigned_cycleway_no_sign',
  'footway_bicycles_allowed',
  'bicycle_allowed_on_footway',
  'footway_sign_bicycles_allowed',
  'on_highway_cycle_lane',
  'bus_lane_with_bicycles',
  'cycle_lane_shared_with_buses',
  'protected_lane_separation',
  'protected_lane_parking',
  'cycleway_crossing',
  /** `{from}`: `cycleway:both` (or `cycleway`) split into `cycleway:left` and `cycleway:right` */
  'split_both_sides',
  /** `{key}`: the `cycleway:<side>` (or `sidewalk:<side>`) value the category needs on that side */
  'side_presence',
  /** conflict, `{target}` `{result}`: the suggested edits do not reach the target */
  'plan_not_enough',
  /** conflict, `{target}` `{result}`: nothing could be derived */
  'plan_no_edits',
] as const

export type TagReasonCode = (typeof TAG_REASON_CODES)[number]

/** One tag condition of an alternative. `value` is what the planner writes when it does not hold. */
interface PlanAtom {
  key: string
  accepts: (value: string | undefined) => boolean
  /** Value to write; `undefined` when the condition cannot be written (`exists`) */
  value?: string
  reason: string
  reasonCode: TagReasonCode
  reasonParams?: Record<string, string>
}

/** An alternative: all atoms together are enough for the match. */
type PlanAlternative = PlanAtom[]

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

/**
 * The object of `side` the planner works on. A road side can have two (`cycleway:right` and
 * `sidewalk:right`): the one under `prefix` wins, else the first.
 */
function findTransformedTags(
  wayTags: OsmTags,
  side: BikelaneResult['_side'],
  prefix?: string,
): OsmTags | undefined {
  const tags: OsmTags = { ...wayTags }
  prepareTags(tags)
  const ofSide = getTransformedObjects(tags, BIKELANE_TRANSFORMATIONS).filter(
    (t) => (t._side ?? 'self') === side,
  )
  return ofSide.find((t) => t._prefix === prefix) ?? ofSide[0]
}

/** The prefix of the side object a category lives on: `sidewalk` for a footway category */
function sidePrefixFor(targetCategoryId: string, side: BikelaneResult['_side']) {
  if (side === 'self') return undefined
  return SIDEWALK_CATEGORY.test(targetCategoryId) ? 'sidewalk' : 'cycleway'
}

function categorizeSide(
  wayTags: OsmTags,
  side: BikelaneResult['_side'],
  prefix?: string,
): string | null {
  const transformed = findTransformedTags(wayTags, side, prefix)
  if (!transformed) return null
  const category = categorizeBikelane(transformed)
  return category?.id ?? null
}

/**
 * Map a transformed tag key back to OSM way tags for writing.
 * Left/right cycleway (and sidewalk) sub-objects use nested keys (`cycleway:right:lane`); the key
 * that names the side itself (`cycleway`) is `cycleway:right`.
 */
export function writeKeyForSide(
  transformedKey: string,
  side: BikelaneResult['_side'],
  prefix: string | null,
): string {
  if (side === 'self') return transformedKey
  // A road side without any tags yet: its tags go under `cycleway:<side>`, never on the road
  prefix ??= 'cycleway'
  if (prefix === 'cycleway' || prefix === 'sidewalk') {
    // The key that names the road side itself (`cycleway=track`) is the value of `cycleway:right`.
    if (transformedKey === prefix) return `${prefix}:${side}`
    return `${prefix}:${side}:${transformedKey}`
  }
  return transformedKey
}

/** Value of `cycleway:<side>` that the categories on a road side need */
const SIDE_PRESENCE: Readonly<Record<string, string>> = {
  cyclewayOnHighway_advisory: 'lane',
  cyclewayOnHighway_exclusive: 'lane',
  cyclewayOnHighway_advisoryOrExclusive: 'lane',
  cyclewayOnHighwayBetweenLanes: 'lane',
  cyclewayOnHighwayProtected: 'track',
  cycleway_adjoining: 'track',
  cycleway_isolated: 'track',
  cycleway_adjoiningOrIsolated: 'track',
  footAndCyclewayShared_adjoining: 'track',
  footAndCyclewayShared_adjoiningOrIsolated: 'track',
  footAndCyclewaySegregated_adjoining: 'track',
  footAndCyclewaySegregated_adjoiningOrIsolated: 'track',
  sharedMotorVehicleLane: 'shared_lane',
  sharedBusLaneBusWithBike: 'share_busway',
  sharedBusLaneBikeWithBus: 'lane',
}

/** Categories of a road side mapped with `sidewalk:<side>`: they need the sidewalk on that side */
const SIDEWALK_CATEGORY = /^footwayBicycleYes_/

interface SideSetup {
  tags: OsmTags
  add: TagPlanEntry[]
  change: TagChangeEntry[]
  remove: string[]
}

/**
 * Prepares one side of a road for `targetCategoryId`:
 * - `cycleway:both` (or `cycleway`) is split into `cycleway:left` and `cycleway:right`, so this
 *   side can change without the other;
 * - `cycleway:<side>` gets the value the category needs (`lane`, `track`, `shared_lane`, …), and
 *   `sidewalk:<side>` is set for a footway category.
 * After this, the side is an object of its own and every planned key goes under its prefix.
 */
function setUpRoadSide(
  wayTags: OsmTags,
  side: 'left' | 'right',
  targetCategoryId: string,
): SideSetup {
  const tags: OsmTags = { ...wayTags }
  const add: TagPlanEntry[] = []
  const change: TagChangeEntry[] = []
  const remove: string[] = []

  const bothKey = ['cycleway:both', 'cycleway'].find((key) => tags[key] !== undefined)
  if (bothKey) {
    const value = tags[bothKey]!
    delete tags[bothKey]
    remove.push(bothKey)
    for (const each of ['left', 'right']) {
      const key = `cycleway:${each}`
      if (tags[key] !== undefined) continue
      tags[key] = value
      add.push({
        key,
        value,
        reason: `Split ${bothKey} into the two sides`,
        reasonCode: 'split_both_sides',
        reasonParams: { from: bothKey },
      })
    }
  }

  const setSide = (key: string, value: string, why: string) => {
    const reason: TagReason = { reason: why, reasonCode: 'side_presence', reasonParams: { key } }
    const planned = add.find((entry) => entry.key === key)
    if (planned) Object.assign(planned, { value }, reason)
    else if (tags[key] === undefined) add.push({ key, value, ...reason })
    else change.push({ key, from: tags[key]!, to: value, ...reason })
    tags[key] = value
  }

  const presence = SIDE_PRESENCE[targetCategoryId]
  const presenceKey = `cycleway:${side}`
  if (presence && tags[presenceKey] !== presence) {
    setSide(presenceKey, presence, `The category needs ${presenceKey}=${presence}`)
  }

  if (SIDEWALK_CATEGORY.test(targetCategoryId)) {
    const key = `sidewalk:${side}`
    const present = [key, 'sidewalk:both', 'sidewalk'].some(
      (k) => tags[k] !== undefined && tags[k] !== 'no' && tags[k] !== 'separate',
    )
    if (!present) setSide(key, 'yes', `The category needs a sidewalk (${key}=yes)`)
  }

  return { tags, add, change, remove }
}

/** `traffic_sign=none` (or `no`) is an observed fact: no sign. The planner never overwrites it. */
function isNoSign(value: string | undefined): boolean {
  return value === 'none' || value === 'no'
}

const eqAtom = (
  key: string,
  value: string,
  reason: string,
  reasonCode: TagReasonCode,
): PlanAtom => ({
  key,
  accepts: (v) => v === value,
  value,
  reason,
  reasonCode,
})

const footwayOrPath: PlanAtom = {
  key: 'highway',
  accepts: (v) => v === 'footway' || v === 'path',
  value: 'footway',
  reason: 'Footway with bicycles allowed',
  reasonCode: 'footway_bicycles_allowed',
}

/**
 * Alternatives for macros that the classifier evaluates imperatively. Each entry is a list of
 * alternatives (any one is enough). Macros without an entry are opaque: the planner writes nothing
 * for them and relies on the dry run.
 */
const MACRO_PLAN_ALTERNATIVES: Record<string, PlanAlternative[]> = {
  bicycle_road_base: [
    [eqAtom('bicycle_road', 'yes', 'Fahrradstraße / bicycle road', 'bicycle_road')],
    [
      {
        key: 'traffic_sign',
        accepts: (v) => hasPrefix(v, 'DE:244'),
        value: 'DE:244.1',
        reason: 'Fahrradstraße sign (DE:244.1)',
        reasonCode: 'bicycle_road_sign',
      },
    ],
  ],
  bicycle_road_vehicle_destination: [
    [
      eqAtom('bicycle_road', 'yes', 'Fahrradstraße / bicycle road', 'bicycle_road'),
      eqAtom(
        'vehicle',
        'destination',
        'Motor vehicles only for destination traffic (Anlieger frei)',
        'vehicle_destination',
      ),
    ],
    [
      {
        key: 'traffic_sign',
        accepts: (v) => hasPrefix(v, 'DE:244') && containsSubstring(v, '1020-30'),
        value: 'DE:244.1,1020-30',
        reason: 'Fahrradstraße sign with Anlieger frei (DE:244.1,1020-30)',
        reasonCode: 'bicycle_road_sign_vehicle_destination',
      },
    ],
  ],
  unsigned_cycleway: [
    [
      eqAtom('highway', 'cycleway', 'Unsigned cycleway', 'unsigned_cycleway'),
      {
        key: 'traffic_sign',
        accepts: isNoSign,
        value: 'none',
        reason: 'Unsigned cycleway (traffic_sign=none)',
        reasonCode: 'unsigned_cycleway_no_sign',
      },
    ],
  ],
  footway_bicycle_yes: [
    [
      footwayOrPath,
      eqAtom('bicycle', 'yes', 'Bicycle allowed on footway', 'bicycle_allowed_on_footway'),
    ],
    [
      footwayOrPath,
      {
        key: 'traffic_sign',
        accepts: (v) => containsSubstring(v, '1022-10'),
        value: 'DE:239,1022-10',
        reason: 'Footway sign with bicycles allowed (DE:239,1022-10)',
        reasonCode: 'footway_sign_bicycles_allowed',
      },
    ],
  ],
  cycleway_on_highway_advisory_or_exclusive_base: [
    [
      eqAtom('highway', 'cycleway', 'On-highway cycle lane', 'on_highway_cycle_lane'),
      {
        key: 'cycleway',
        accepts: (v) => v === 'lane' || v === 'opposite_lane',
        value: 'lane',
        reason: 'On-highway cycle lane',
        reasonCode: 'on_highway_cycle_lane',
      },
    ],
  ],
  shared_bus_lane_bus_with_bike: [
    [
      eqAtom('highway', 'cycleway', 'Bus lane with bicycles allowed', 'bus_lane_with_bicycles'),
      eqAtom(
        'cycleway',
        'share_busway',
        'Bus lane with bicycles allowed',
        'bus_lane_with_bicycles',
      ),
    ],
  ],
  shared_bus_lane_bike_with_bus: [
    [
      eqAtom('highway', 'cycleway', 'Cycle lane shared with buses', 'cycle_lane_shared_with_buses'),
      eqAtom(
        'lane',
        'share_busway',
        'Cycle lane shared with buses',
        'cycle_lane_shared_with_buses',
      ),
    ],
  ],
  cycleway_on_highway_protected: [
    [
      {
        key: 'separation:left',
        accepts: (v) => v != null && (PROTECTIVE_SEPARATION as readonly string[]).includes(v),
        value: PROTECTIVE_SEPARATION[0],
        reason: 'Protected cycle lane: physical separation towards the road',
        reasonCode: 'protected_lane_separation',
      },
    ],
    [
      eqAtom(
        'traffic_mode:left',
        'parking',
        'Protected cycle lane: parking towards the road',
        'protected_lane_parking',
      ),
    ],
  ],
  crossing: [
    [
      eqAtom('highway', 'cycleway', 'Cycleway crossing', 'cycleway_crossing'),
      eqAtom('cycleway', 'crossing', 'Cycleway crossing', 'cycleway_crossing'),
    ],
  ],
}

/** The value to write for a substring condition: traffic sign numbers get the `DE:` prefix. */
function valueForSubstring(key: string, substring: string): string {
  if (key === 'traffic_sign' && /^\d/.test(substring)) return `DE:${substring}`
  return substring
}

/**
 * Expand a predicate into alternatives (disjunctive normal form over the positive tag conditions).
 * Negative conditions (`neq`, `notIn`, `notExists`, `not`) write nothing: the dry run checks them.
 */
function alternativesOf(predicate: TagPredicate, why: TagReason): PlanAlternative[] {
  const { reason, reasonCode, reasonParams } = why
  switch (predicate.op) {
    case 'eq':
      return [[{ ...eqAtom(predicate.key, predicate.value, reason, reasonCode), reasonParams }]]
    case 'in': {
      const values = predicate.values
      return [
        [
          {
            key: predicate.key,
            accepts: (v) => v != null && values.includes(v),
            value: values[0],
            reason,
            reasonCode,
            reasonParams,
          },
        ],
      ]
    }
    case 'includes': {
      const { key, substring } = predicate
      return [
        [
          {
            key,
            accepts: (v) => containsSubstring(v, substring),
            value: valueForSubstring(key, substring),
            reason,
            reasonCode,
            reasonParams,
          },
        ],
      ]
    }
    case 'hasPrefix': {
      const { key, prefix } = predicate
      return [
        [
          {
            key,
            accepts: (v) => hasPrefix(v, prefix),
            value: prefix,
            reason,
            reasonCode,
            reasonParams,
          },
        ],
      ]
    }
    case 'exists':
      return [[{ key: predicate.key, accepts: (v) => v != null, reason, reasonCode, reasonParams }]]
    case 'and': {
      let result: PlanAlternative[] = [[]]
      for (const child of predicate.predicates) {
        const childAlternatives = alternativesOf(child, why)
        const next: PlanAlternative[] = []
        for (const left of result) {
          for (const right of childAlternatives) next.push([...left, ...right])
        }
        result = next
      }
      return result
    }
    case 'or':
      return predicate.predicates.flatMap((child) => alternativesOf(child, why))
    case 'macro':
      return MACRO_PLAN_ALTERNATIVES[predicate.name] ?? [[]]
    case 'literal':
      return predicate.value ? [[]] : []
    case 'neq':
    case 'notIn':
    case 'notExists':
    case 'hasSuffix':
    case 'hasTagWithPrefix':
    case 'not':
      return [[]]
    default:
      return [[]]
  }
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

function targetAlternatives(targetCategoryId: string): PlanAlternative[] {
  const resolved = findParentSpecAndRefining(targetCategoryId)
  if (!resolved) return []
  const { parent, refining } = resolved
  const base = parent.match
    ? alternativesOf(parent.match, {
        reason: `Required for ${targetCategoryId}`,
        reasonCode: 'required_for_category',
        reasonParams: { category: targetCategoryId },
      })
    : [[]]
  if (!refining) return base
  const refined = alternativesOf(refining.match, {
    reason: `Discriminator for ${targetCategoryId}`,
    reasonCode: 'discriminator_for_category',
    reasonParams: { category: targetCategoryId },
  })
  return base.flatMap((left) => refined.map((right) => [...left, ...right]))
}

/** The traffic signs that settle `categoryId` on their own, and whether it works without a sign. */
export interface CategorySignOptions {
  /** Signs the planner writes for the category (`DE:240`); never `none` */
  signs: string[]
  /** Some alternative of the category needs no traffic sign (or `traffic_sign=none`) */
  unsignedPossible: boolean
}

/** Which traffic signs settle `categoryId`, read from the category specs. */
export function categorySignOptions(categoryId: string): CategorySignOptions {
  const signs = new Set<string>()
  let unsignedPossible = false
  for (const alternative of targetAlternatives(categoryId)) {
    const signAtoms = alternative.filter(
      (atom) => atom.key === 'traffic_sign' && atom.value != null && !isNoSign(atom.value),
    )
    for (const atom of signAtoms) signs.add(atom.value!)
    if (signAtoms.length === 0) unsignedPossible = true
  }
  return { signs: [...signs], unsignedPossible }
}

interface Candidate {
  /** transformed key → value */
  edits: Map<string, TagReason & { value: string }>
  cost: number
}

function editCost(key: string, from: string | undefined, to: string, side: string): number {
  if (key === 'highway') return 10
  if (key === 'traffic_sign') {
    if (from == null) return isNoSign(to) ? 1 : 4
    return 5
  }
  if (from != null) return 3
  // `cycleway=*` on a way of its own is a transformed-tag shape of road sides
  if (key === 'cycleway' && side === 'self') return 3
  return 1
}

function candidateFor(
  alternative: PlanAlternative,
  base: OsmTags,
  fixedKeys: ReadonlySet<string>,
  side: string,
): Candidate | undefined {
  const edits: Candidate['edits'] = new Map()
  // Writable conditions first, so `exists` sees the values planned in the same alternative.
  const ordered = [...alternative].sort(
    (a, b) => Number(a.value === undefined) - Number(b.value === undefined),
  )
  let cost = 0
  for (const atom of ordered) {
    const planned = edits.get(atom.key)?.value
    const current = planned ?? base[atom.key]
    if (atom.accepts(current)) continue
    if (planned !== undefined) return undefined // two conditions on one key contradict
    if (atom.value === undefined) return undefined
    if (atom.key.startsWith('_')) return undefined // derived by the processing, not a tag
    // On a road side `highway` is the road's: the side's own `highway` is derived from its prefix
    if (atom.key === 'highway' && side !== 'self') return undefined
    if (fixedKeys.has(atom.key)) return undefined
    if (atom.key === 'traffic_sign' && isNoSign(base.traffic_sign)) return undefined
    edits.set(atom.key, {
      value: atom.value,
      reason: atom.reason,
      reasonCode: atom.reasonCode,
      reasonParams: atom.reasonParams,
    })
    cost += editCost(atom.key, base[atom.key], atom.value, side)
  }
  return { edits, cost }
}

/** Drops `reasonParams` when it is empty, so plans stay free of `undefined` fields. */
function reasonOf(why: TagReason): TagReason {
  const { reason, reasonCode, reasonParams } = why
  return reasonParams ? { reason, reasonCode, reasonParams } : { reason, reasonCode }
}

function applyPlanToWayTags(
  wayTags: OsmTags,
  add: TagPlanEntry[],
  change: TagChangeEntry[],
  remove: readonly string[] = [],
): OsmTags {
  const next: OsmTags = { ...wayTags }
  for (const key of remove) delete next[key]
  for (const entry of change) {
    next[entry.key] = entry.to
  }
  for (const entry of add) {
    if (next[entry.key] == null) next[entry.key] = entry.value
  }
  return next
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
  /**
   * Tags the plan must contain, in transformed (bare) keys: `{ traffic_sign: 'DE:240' }`. They are
   * written for the side (`cycleway:right:traffic_sign`) and may overwrite `traffic_sign=none`: a
   * fixed tag is an explicit choice of the mapper (a mapping target).
   */
  fixed?: Record<string, string>
}

export class UnknownTargetCategoryError extends Error {
  constructor(public readonly targetCategoryId: string) {
    super(`Unknown target category: ${targetCategoryId}`)
    this.name = 'UnknownTargetCategoryError'
  }
}

const FIXED_REASON: TagReason = {
  reason: 'Fixed tag of the mapping target',
  reasonCode: 'fixed_by_mapping_target',
}

/**
 * Plan tag adds/changes to reach `targetCategoryId` for the given way and side.
 *
 * Returned keys use nested OSM form for left/right cycleway (and sidewalk) sides
 * (`cycleway:right:lane`); bare keys for self-side objects.
 *
 * - Tags that settle a category are alternatives: `segregated=yes` (with `bicycle` and `foot`) or
 *   `traffic_sign=DE:241` is enough, the plan never asks for both. Plans that add no traffic sign
 *   come first.
 * - `traffic_sign=none` is never overwritten (unless `options.fixed` says so).
 * - Macros the classifier evaluates imperatively have preferred tags (`MACRO_PLAN_ALTERNATIVES`);
 *   the rest (e.g. `cyclewayOnHighwayProtected`) may still yield a `_category` conflict.
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
  const fixed = options?.fixed ?? {}
  const sidePrefix = sidePrefixFor(targetCategoryId, side)
  const currentCategoryId = categorizeSide(wayTags, side, sidePrefix)
  const noSetup: SideSetup = { tags: wayTags, add: [], change: [], remove: [] }
  const setup = side === 'self' ? noSetup : setUpRoadSide(wayTags, side, targetCategoryId)
  const working = setup.tags
  const transformed = findTransformedTags(working, side, sidePrefix)
  const prefix = transformed?._prefix ?? sidePrefix ?? null
  const tags = transformed ?? working

  // Adds `key=value` (written for the side) unless it holds; a planned entry of the side setup is
  // replaced.
  const plan = (
    add: TagPlanEntry[],
    change: TagChangeEntry[],
    key: string,
    value: string,
    why: TagReason,
  ) => {
    const writeKey = writeKeyForSide(key, side, prefix)
    const planned = add.findIndex((entry) => entry.key === writeKey)
    if (planned >= 0) {
      add[planned] = { key: writeKey, value, ...why }
      return
    }
    const current = working[writeKey] ?? tags[key]
    if (current === value) return
    if (current == null) add.push({ key: writeKey, value, ...why })
    else change.push({ key: writeKey, from: current, to: value, ...why })
  }

  const fixedAdd: TagPlanEntry[] = []
  const fixedChange: TagChangeEntry[] = []
  for (const [key, value] of Object.entries(fixed)) {
    plan(fixedAdd, fixedChange, key, value, FIXED_REASON)
  }

  if (currentCategoryId === targetCategoryId && !fixedAdd.length && !fixedChange.length) {
    return {
      targetCategoryId,
      currentCategoryId,
      aligned: true,
      add: [],
      change: [],
      remove: [],
      conflicts: [],
    }
  }

  const base: OsmTags = { ...tags, ...fixed }
  const fixedKeys = new Set(Object.keys(fixed))

  // The empty alternative first: the fixed tags alone may be enough.
  const candidates: Candidate[] = [{ edits: new Map(), cost: 0 }]
  for (const alternative of targetAlternatives(targetCategoryId)) {
    const candidate = candidateFor(alternative, base, fixedKeys, side)
    if (candidate) candidates.push(candidate)
  }
  candidates.sort((a, b) => a.cost - b.cost) // stable: spec order breaks ties

  const { remove } = setup
  const seen = new Set<string>()
  let fallback: { add: TagPlanEntry[]; change: TagChangeEntry[]; result: string | null } | undefined

  for (const candidate of candidates) {
    const signature = [...candidate.edits.entries()]
      .map(([k, v]) => `${k}=${v.value}`)
      .sort()
      .join(';')
    if (seen.has(signature)) continue
    seen.add(signature)

    const add: TagPlanEntry[] = [...setup.add, ...fixedAdd]
    const change: TagChangeEntry[] = [...setup.change, ...fixedChange]
    for (const [key, edit] of candidate.edits) {
      plan(add, change, key, edit.value, reasonOf(edit))
    }

    const result = categorizeSide(
      applyPlanToWayTags(wayTags, add, change, remove),
      side,
      sidePrefix,
    )
    if (result === targetCategoryId) {
      return {
        targetCategoryId,
        currentCategoryId,
        aligned: true,
        add,
        change,
        remove,
        conflicts: [],
      }
    }
    // The first candidate with edits explains best why the target is out of reach.
    if (!fallback || (!fallback.add.length && !fallback.change.length)) {
      fallback = { add, change, result }
    }
  }

  const add = fallback?.add ?? []
  const change = fallback?.change ?? []
  const resultCategory = fallback?.result ?? currentCategoryId
  const suggested =
    add.length > 0 || change.length > 0
      ? 'Suggested tag edits are not enough to reach that classification.'
      : 'No automatic tag edits could be derived for this category (often because it matches via a complex macro).'
  return {
    targetCategoryId,
    currentCategoryId,
    aligned: false,
    add,
    change,
    remove,
    conflicts: [
      {
        key: '_category',
        value: resultCategory ?? 'null',
        reason: `${suggested} Target “${targetCategoryId}” would still classify as ${resultCategory ?? 'none'}.`,
        reasonCode: add.length > 0 || change.length > 0 ? 'plan_not_enough' : 'plan_no_edits',
        reasonParams: { target: targetCategoryId, result: resultCategory ?? 'none' },
      },
    ],
  }
}

function planSignature(plan: CategoryTagPlan): string {
  return [
    ...plan.add.map((e) => `+${e.key}=${e.value}`),
    ...plan.change.map((e) => `~${e.key}=${e.to}`),
    ...plan.remove.map((key) => `-${key}`),
  ]
    .sort()
    .join(';')
}

/**
 * The ways to reach `targetCategoryId`, the plan of `planTagsForCategory` first (`default`).
 * For categories a traffic sign can settle, further variants: `with_sign` (the sign of the
 * category) and `without_sign` (`traffic_sign=none` plus the tags that say the same). Variants that
 * do not reach the target or repeat an earlier one are left out.
 */
export function planTagVariantsForCategory(
  wayTags: OsmTags,
  targetCategoryId: string,
  options?: PlanTagsForCategoryOptions,
): CategoryTagPlanVariant[] {
  const first = planTagsForCategory(wayTags, targetCategoryId, options)
  const variants: CategoryTagPlanVariant[] = [{ ...first, variantId: 'default' }]
  if (options?.fixed?.traffic_sign !== undefined) return variants

  const { signs, unsignedPossible } = categorySignOptions(targetCategoryId)
  if (!signs.length) return variants

  const seen = new Set([planSignature(first)])
  const push = (variantId: CategoryTagPlanVariantId, fixedSign: string) => {
    const plan = planTagsForCategory(wayTags, targetCategoryId, {
      ...options,
      fixed: { ...options?.fixed, traffic_sign: fixedSign },
    })
    const signature = planSignature(plan)
    if (!plan.aligned || seen.has(signature)) return
    seen.add(signature)
    variants.push({ ...plan, variantId })
  }

  const side = options?.side ?? 'self'
  const currentSign = findTransformedTags(
    wayTags,
    side,
    sidePrefixFor(targetCategoryId, side),
  )?.traffic_sign
  const signHolds = signs.some(
    (sign) => currentSign != null && containsSubstring(currentSign, sign),
  )
  if (!signHolds) push('with_sign', signs[0]!)
  if (unsignedPossible && !isNoSign(currentSign)) push('without_sign', 'none')
  return variants
}
