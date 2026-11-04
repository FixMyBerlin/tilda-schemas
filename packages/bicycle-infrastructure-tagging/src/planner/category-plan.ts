import {
  MAJOR_ROAD_CLASSES,
  MINOR_ROAD_CLASSES,
  TRUNK_MOTORWAY_CLASSES,
  planTagsForCategory,
  processBikelanes,
  type CategoryTagPlan,
  type TagPlanEntry,
} from '@tilda-geo/bicycle-infrastructure'
import {
  mappingTargetById,
  mappingTargetsForCategory,
  type MappingTarget,
} from '../mapping-targets/mapping-targets.ts'
import type { OsmTags, ResultSide } from '../types.ts'

/**
 * Tag plans to reach a TILDA bike infrastructure category, on top of `planTagsForCategory` from
 * `@tilda-geo/bicycle-infrastructure` (which stays in the core package: it needs the category
 * specs, and the core re-exports it during 0.x).
 *
 * The wrapper adds what the core planner leaves out: it splits `cycleway:both` so one side can
 * change, sets the `cycleway:<side>` value a category needs, suggests tags for the categories the
 * core matches with macros (shared bus lanes, crossings), explains targets that do not fit the
 * geometry of the way, and lists the keys to remove. Messages are codes with parameters; the app
 * writes the text.
 */

/** Why an entry is in the plan. `category_requirement` carries the core's English text in `reason`. */
export type PlanReasonCode =
  | 'category_requirement'
  | 'split_both_sides'
  | 'side_presence'
  | 'macro_suggestion'
  /** a tag the mapping target fixes (`traffic_sign=DE:240`) */
  | 'mapping_target'

export interface PlannedAdd {
  key: string
  value: string
  code: PlanReasonCode
  /** `split_both_sides`: `{ from: 'cycleway:both' }` */
  params?: Record<string, string>
  /** The core's text (English), for `category_requirement` */
  reason?: string
}

export interface PlannedChange {
  key: string
  from: string
  to: string
  code: PlanReasonCode
  params?: Record<string, string>
  reason?: string
}

export type PlanConflictCode =
  | 'geometry_bicycle_road_on_sidewalk'
  | 'geometry_lane_needs_road'
  | 'geometry_bus_lane_needs_road'
  | 'geometry_crossing_on_sidewalk'
  | 'geometry_pedestrian_area_needs_pedestrian'
  /** a path category on the centerline of a road: plan it for a road side instead */
  | 'geometry_path_needs_road_side'
  /** a lane category on the centerline of a road: plan it for a road side instead */
  | 'geometry_lane_needs_road_side'
  /** a category of the road itself or of a way of its own (bicycle road, link, crossing) on a road side */
  | 'geometry_not_a_road_side'
  /** `*_isolated` on a road side: a road side always runs along the road */
  | 'geometry_isolated_not_a_road_side'
  /** a mapping target for a way of its own (two lines) planned for a road side */
  | 'geometry_needs_separate_way'
  /** `planForMappingTarget` with an id that is not in `MAPPING_TARGETS` */
  | 'unknown_mapping_target'
  /** the planned tags still classify as another category; `params.result` */
  | 'tags_not_enough'
  /** no tags could be derived for the target */
  | 'no_suggestion'

export interface PlanConflict {
  code: PlanConflictCode
  key: string
  value: string
  params?: Record<string, string>
}

/**
 * One way to reach the target. `planCategoryVariants` returns a list of these: the plan the planner
 * prefers, then one per mapping target of the category.
 */
export interface CategoryChangePlan {
  /** `default` for the first variant, else the id of the mapping target */
  variantId: string
  /** The mapping target this plan reaches (`MAPPING_TARGETS`), if any */
  mappingTargetId?: string
  targetCategoryId: string
  currentCategoryId: string | null
  /** `processBikelanes` gives the target for the planned tags */
  aligned: boolean
  add: PlannedAdd[]
  change: PlannedChange[]
  /** keys to delete (`cycleway:both` when it is split into the sides) */
  remove: string[]
  conflicts: PlanConflict[]
}

/** Value of `cycleway:<side>` that on-road categories need on that side */
const SIDE_PRESENCE: Record<string, string> = {
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

/** Tags for categories matched only by core macros; without them the core plan is empty */
const MACRO_CATEGORY_SUGGESTIONS: Record<string, { key: string; value: string }[]> = {
  bicycleRoad: [{ key: 'bicycle_road', value: 'yes' }],
  bicycleRoad_vehicleDestination: [
    { key: 'bicycle_road', value: 'yes' },
    { key: 'vehicle', value: 'destination' },
  ],
  sharedBusLaneBikeWithBus: [
    { key: 'highway', value: 'cycleway' },
    { key: 'lane', value: 'share_busway' },
  ],
  sharedBusLaneBusWithBike: [
    { key: 'highway', value: 'cycleway' },
    { key: 'cycleway', value: 'share_busway' },
  ],
  crossing: [
    { key: 'highway', value: 'cycleway' },
    { key: 'cycleway', value: 'crossing' },
  ],
}

const CARRIAGEWAY_CLASSES = new Set<string>([
  ...TRUNK_MOTORWAY_CLASSES,
  ...MAJOR_ROAD_CLASSES,
  ...MINOR_ROAD_CLASSES,
])
CARRIAGEWAY_CLASSES.delete('pedestrian')

/** Categories of paths: on a road they are a road side, on the centerline they need a way of their own */
const PATH_CATEGORY = /^(cycleway|footAndCycleway(Shared|Segregated)|footwayBicycleYes)_/
/** Categories of a road side: on the centerline of a road they need a side */
const ROAD_SIDE_CATEGORY =
  /^(cyclewayOnHighway_|cyclewayOnHighwayProtected$|sharedMotorVehicleLane$|sharedBusLane)/
/** Categories of the road itself (`bicycleRoad`, between lanes) or of a way of its own */
const NOT_A_ROAD_SIDE_CATEGORY =
  /^(bicycleRoad|cyclewayOnHighwayBetweenLanes$|cyclewayLink$|crossing$|pedestrianAreaBicycleYes$)/

const isCarriageway = (tags: OsmTags) => !!tags.highway && CARRIAGEWAY_CLASSES.has(tags.highway)

function isSidewalkFootway(tags: OsmTags) {
  return (
    tags.highway === 'footway' &&
    (tags.footway === 'sidewalk' || tags['is_sidepath:of'] !== undefined)
  )
}

/**
 * Why `target` cannot be reached on this kind of way (the way's geometry or mapping style does not
 * fit), or `undefined` if it can.
 */
export function categoryGeometryMismatch(
  tags: OsmTags,
  target: string,
  /**
   * With a side, also the rules between road centerline, road sides and ways of their own (a path
   * category on a road's centerline, a bicycle road on a road side, ...). Without, only the rules
   * that hold for any side.
   */
  side?: ResultSide,
): PlanConflictCode | undefined {
  if (target.startsWith('bicycleRoad') && isSidewalkFootway(tags)) {
    return 'geometry_bicycle_road_on_sidewalk'
  }
  if (
    (target.startsWith('cyclewayOnHighway') || target === 'sharedMotorVehicleLane') &&
    !isCarriageway(tags)
  ) {
    return 'geometry_lane_needs_road'
  }
  if (target.startsWith('sharedBusLane') && tags.highway !== 'cycleway' && !isCarriageway(tags)) {
    return 'geometry_bus_lane_needs_road'
  }
  if (target === 'crossing' && tags.footway === 'sidewalk') {
    return 'geometry_crossing_on_sidewalk'
  }
  if (target === 'pedestrianAreaBicycleYes' && tags.highway !== 'pedestrian') {
    return 'geometry_pedestrian_area_needs_pedestrian'
  }
  if (side === undefined) return undefined

  // With a side, also the rules between road centerline, road sides and ways of their own
  const roadCenterline = side === 'self' && isCarriageway(tags) && tags.highway !== 'service'
  if (roadCenterline && PATH_CATEGORY.test(target)) return 'geometry_path_needs_road_side'
  if (roadCenterline && ROAD_SIDE_CATEGORY.test(target)) return 'geometry_lane_needs_road_side'
  if (side !== 'self' && NOT_A_ROAD_SIDE_CATEGORY.test(target)) return 'geometry_not_a_road_side'
  if (side !== 'self' && target.endsWith('_isolated')) return 'geometry_isolated_not_a_road_side'
  return undefined
}

/** The tags after applying `plan` */
export function applyCategoryPlan(
  tags: OsmTags,
  plan: Pick<CategoryChangePlan, 'add' | 'change'> & { remove?: string[] },
): OsmTags {
  const next = { ...tags }
  for (const key of plan.remove ?? []) delete next[key]
  for (const entry of plan.change) next[entry.key] = entry.to
  for (const entry of plan.add) next[entry.key] ??= entry.value
  return next
}

/**
 * Splits `cycleway:both` / `cycleway` into `cycleway:left` and `cycleway:right`, so one side can
 * change without the other. Returns the tags, the removed key and the added tags.
 */
export function splitBothSides(tags: OsmTags): {
  tags: OsmTags
  remove: string[]
  add: PlannedAdd[]
} {
  const bothKey =
    tags['cycleway:both'] !== undefined
      ? 'cycleway:both'
      : tags.cycleway !== undefined
        ? 'cycleway'
        : undefined
  if (!bothKey) return { tags, remove: [], add: [] }

  const value = tags[bothKey]!
  const next = { ...tags }
  delete next[bothKey]
  const add: PlannedAdd[] = []
  for (const side of ['left', 'right']) {
    const key = `cycleway:${side}`
    if (next[key] === undefined) {
      next[key] = value
      add.push({ key, value, code: 'split_both_sides', params: { from: bothKey } })
    }
  }
  return { tags: next, remove: [bothKey], add }
}

/**
 * Workaround for `planTagsForCategory` on left/right sides: it writes the presence key as
 * `cycleway:<side>:cycleway`, and without a `cycleway:<side>` tag it plans bare keys (`lane`)
 * instead of `cycleway:<side>:lane`.
 */
function sideKey(key: string, side: ResultSide) {
  if (side === 'self') return key
  const prefix = `cycleway:${side}`
  if (key === `${prefix}:cycleway`) return prefix
  if (key.startsWith('cycleway:') || key === 'highway' || key.startsWith('sidewalk')) return key
  return `${prefix}:${key}`
}

/** The category TILDA reads for one side of the way */
export function categoryForSide(tags: OsmTags, side: ResultSide): string | undefined {
  return processBikelanes(tags).find((result) => result._side === side)?.category
}

function withSuggestions(
  plan: CategoryTagPlan,
  suggestions: { key: string; value: string }[],
  tags: OsmTags,
): { add: PlannedAdd[]; change: PlannedChange[] } {
  const planned = new Set([...plan.add.map((e) => e.key), ...plan.change.map((e) => e.key)])
  const add: PlannedAdd[] = plan.add.map(fromCoreAdd)
  const change: PlannedChange[] = plan.change.map(fromCoreChange)

  for (const suggestion of suggestions) {
    if (planned.has(suggestion.key)) continue
    const current = tags[suggestion.key]
    if (current === undefined) {
      add.push({ ...suggestion, code: 'macro_suggestion' })
    } else if (current !== suggestion.value) {
      change.push({
        key: suggestion.key,
        from: current,
        to: suggestion.value,
        code: 'macro_suggestion',
      })
    }
    planned.add(suggestion.key)
  }
  return { add, change }
}

const fromCoreAdd = (entry: TagPlanEntry): PlannedAdd => ({
  key: entry.key,
  value: entry.value,
  code: 'category_requirement',
  reason: entry.reason,
})

const fromCoreChange = (entry: CategoryTagPlan['change'][number]): PlannedChange => ({
  key: entry.key,
  from: entry.from,
  to: entry.to,
  code: 'category_requirement',
  reason: entry.reason,
})

type VariantIds = { variantId: string; mappingTargetId?: string }

const variantIds = (variantId: string, mappingTargetId: string | undefined): VariantIds =>
  mappingTargetId === undefined ? { variantId } : { variantId, mappingTargetId }

function conflictPlan(
  tags: OsmTags,
  target: string,
  side: ResultSide,
  conflict: PlanConflict,
  ids: VariantIds,
): CategoryChangePlan {
  return {
    ...ids,
    targetCategoryId: target,
    currentCategoryId: categoryForSide(tags, side) ?? null,
    aligned: false,
    add: [],
    change: [],
    remove: [],
    conflicts: [conflict],
  }
}

function geometryConflict(tags: OsmTags, code: PlanConflictCode): PlanConflict {
  return {
    code,
    key: tags.highway ? 'highway' : 'category',
    value: tags.highway ?? 'none',
    params: tags.highway ? { highway: tags.highway } : undefined,
  }
}

/** One plan to reach `target` on `side`, with the tags `fixed` must contain (bare keys). */
function planOne(
  tags: OsmTags,
  target: string,
  side: ResultSide,
  fixed: Readonly<Record<string, string>>,
  ids: VariantIds,
): CategoryChangePlan {
  const mismatch = categoryGeometryMismatch(tags, target, side)
  if (mismatch) return conflictPlan(tags, target, side, geometryConflict(tags, mismatch), ids)

  // one side: split `:both` first and make sure the side has the right `cycleway:<side>` value
  const split =
    side === 'self'
      ? { tags, remove: [] as string[], add: [] as PlannedAdd[] }
      : splitBothSides(tags)
  let working = split.tags
  const add: PlannedAdd[] = [...split.add]
  const change: PlannedChange[] = []

  const presence = side === 'self' ? undefined : SIDE_PRESENCE[target]
  if (presence) {
    const key = `cycleway:${side}`
    const current = working[key]
    if (current !== presence) {
      const splitEntry = add.find((entry) => entry.key === key)
      if (splitEntry) {
        splitEntry.value = presence
        splitEntry.code = 'side_presence'
        splitEntry.params = { key }
      } else if (current === undefined) {
        add.push({ key, value: presence, code: 'side_presence', params: { key } })
      } else {
        change.push({ key, from: current, to: presence, code: 'side_presence', params: { key } })
      }
      working = { ...working, [key]: presence }
    }
  }

  if (side !== 'self' && SIDEWALK_CATEGORY.test(target)) {
    const key = `sidewalk:${side}`
    const present = [key, 'sidewalk:both', 'sidewalk'].some(
      (k) => working[k] !== undefined && working[k] !== 'no' && working[k] !== 'separate',
    )
    if (!present) {
      if (working[key] === undefined) {
        add.push({ key, value: 'yes', code: 'side_presence', params: { key } })
      } else {
        change.push({ key, from: working[key]!, to: 'yes', code: 'side_presence', params: { key } })
      }
      working = { ...working, [key]: 'yes' }
    }
  }

  const fixedKeys = Object.keys(fixed)
  const base = planTagsForCategory(working, target, {
    ...(side === 'self' ? {} : { side }),
    ...(fixedKeys.length ? { fixed: { ...fixed } } : {}),
  })
  // On a road side `highway` would retag the whole road, and the presence key (`cycleway`) is set
  // above as `cycleway:<side>`: both are for separate ways only.
  const suggestions = MACRO_CATEGORY_SUGGESTIONS[target]?.filter(
    (entry) => side === 'self' || (entry.key !== 'highway' && entry.key !== 'cycleway'),
  )
  const library = suggestions
    ? withSuggestions(base, suggestions, working)
    : { add: base.add.map(fromCoreAdd), change: base.change.map(fromCoreChange) }

  const isFixed = (key: string) =>
    fixedKeys.some((fixedKey) => key === fixedKey || key.endsWith(`:${side}:${fixedKey}`))
  const asFixed = <T extends PlannedAdd | PlannedChange>(entry: T): T => {
    if (!isFixed(entry.key)) return entry
    const next = { ...entry, code: 'mapping_target' as const }
    delete next.reason
    return next
  }

  for (const entry of library.add) {
    const key = sideKey(entry.key, side)
    if (working[key] === undefined && !add.some((existing) => existing.key === key)) {
      add.push(asFixed({ ...entry, key }))
    }
  }
  for (const entry of library.change) {
    const key = sideKey(entry.key, side)
    if (working[key] !== entry.to) {
      change.push(asFixed({ ...entry, key, from: working[key] ?? entry.from }))
    }
  }

  const plan: CategoryChangePlan = {
    ...ids,
    targetCategoryId: target,
    currentCategoryId: base.currentCategoryId,
    aligned: base.aligned,
    add,
    change,
    remove: split.remove,
    conflicts: [],
  }
  const result = categoryForSide(applyCategoryPlan(tags, plan), side)
  if (result === target) return { ...plan, aligned: true }

  const hasEdits = add.length > 0 || change.length > 0 || plan.remove.length > 0
  return {
    ...plan,
    aligned: false,
    conflicts: [
      hasEdits
        ? {
            code: 'tags_not_enough',
            key: 'category',
            value: result ?? 'none',
            params: { result: result ?? 'none' },
          }
        : { code: 'no_suggestion', key: 'category', value: result ?? 'none' },
    ],
  }
}

function planMappingTarget(
  tags: OsmTags,
  mappingTarget: MappingTarget,
  side: ResultSide,
  variantId: string,
): CategoryChangePlan {
  const ids = variantIds(variantId, mappingTarget.id)
  if (mappingTarget.separateWayOnly && side !== 'self') {
    return conflictPlan(
      tags,
      mappingTarget.categoryId,
      side,
      { code: 'geometry_needs_separate_way', key: 'side', value: side, params: { side } },
      ids,
    )
  }
  return planOne(tags, mappingTarget.categoryId, side, mappingTarget.fixed, ids)
}

/**
 * The plan to reach a mapping target (`MAPPING_TARGETS`) on `side` of the way: the category of the
 * target with its fixed tags (`traffic_sign=DE:240`, or `traffic_sign=none` + `segregated=no`).
 */
export function planForMappingTarget(
  tags: OsmTags,
  targetId: string,
  side: ResultSide,
): CategoryChangePlan {
  const mappingTarget = mappingTargetById(targetId)
  if (!mappingTarget) {
    return conflictPlan(
      tags,
      targetId,
      side,
      { code: 'unknown_mapping_target', key: 'mappingTarget', value: targetId },
      { variantId: targetId },
    )
  }
  return planMappingTarget(tags, mappingTarget, side, mappingTarget.id)
}

/**
 * The ways to reach `target` on `side` of the way. The first one (`default`) is the plan the
 * planner prefers: fewest edits, no new traffic sign, `traffic_sign=none` kept. Then one plan per
 * mapping target of the category (`variantId` = its id), also those that do not fit the way (they
 * carry a conflict). A mapping target without fixed tags is the default plan itself and gets no
 * entry of its own.
 */
export function planCategoryVariants(
  tags: OsmTags,
  target: string,
  side: ResultSide,
): CategoryChangePlan[] {
  const targets = mappingTargetsForCategory(target)
  const plain = targets.find((t) => Object.keys(t.fixed).length === 0)
  const variants = [planOne(tags, target, side, {}, variantIds('default', plain?.id))]
  for (const mappingTarget of targets) {
    if (mappingTarget === plain) continue
    variants.push(planMappingTarget(tags, mappingTarget, side, mappingTarget.id))
  }
  return variants
}

/**
 * Tags to add, change or remove so that `side` of the way gets `target`: the first variant of
 * `planCategoryVariants`. Conflicts explain why a target cannot be reached.
 */
export function planCategoryChange(
  tags: OsmTags,
  target: string,
  side: ResultSide,
): CategoryChangePlan {
  const plain = mappingTargetsForCategory(target).find((t) => Object.keys(t.fixed).length === 0)
  return planOne(tags, target, side, {}, variantIds('default', plain?.id))
}
