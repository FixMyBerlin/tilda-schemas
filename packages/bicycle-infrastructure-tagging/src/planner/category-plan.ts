import {
  MAJOR_ROAD_CLASSES,
  MINOR_ROAD_CLASSES,
  TRUNK_MOTORWAY_CLASSES,
  categorySidePrefix,
  planTagsForCategory,
  processBikelanes,
  type CategoryTagPlan,
  type PlanLifecycle,
  type TagPlanEntry,
  type TagReasonCode,
  writeKeyForSide,
} from '@tilda-geo/bicycle-infrastructure'
import {
  mappingChoiceId,
  resolveMappingChoice,
  type MappingChoice,
} from '../mapping-targets/mapping-targets.ts'
import type { OsmTags, ResultSide } from '../types.ts'

/**
 * Tag plans to reach a TILDA bike infrastructure category, on top of `planTagsForCategory` from
 * `@tilda-geo/bicycle-infrastructure` (which stays in the core package: it needs the category
 * specs, and the core re-exports it during 0.x).
 *
 * The core plans a road side completely (it splits `cycleway:both` and sets the `cycleway:<side>`
 * value a category needs). The wrapper adds what the core leaves out: it suggests tags for the
 * categories the core matches with macros (shared bus lanes, crossings), explains targets that do
 * not fit the geometry of the way, and offers the mapping targets as variants. Messages are codes
 * with parameters; the app writes the text.
 */

/**
 * Why an entry is in the plan. `category_requirement` carries the core's English text in `reason`
 * and its stable code in `reasonCode` (with `params` from the core's `reasonParams`). The texts:
 * `PLAN_MESSAGES` and `renderPlanMessage`.
 */
export const PLAN_REASON_CODES = [
  'category_requirement',
  'split_both_sides',
  'side_presence',
  'macro_suggestion',
  /** a tag the mapping target fixes (`traffic_sign=DE:240`) */
  'mapping_target',
] as const

export type PlanReasonCode = (typeof PLAN_REASON_CODES)[number]

export interface PlannedAdd {
  key: string
  value: string
  code: PlanReasonCode
  /** `split_both_sides`: `{ from: 'cycleway:both' }` */
  params?: Record<string, string>
  /** The core's text (English), for `category_requirement` */
  reason?: string
  /** The core's stable code for `reason`, for `category_requirement` */
  reasonCode?: TagReasonCode
  /**
   * Values the mapper can pick instead of `value` (the default, also the first entry), sorted by
   * use. Show them as a selection: `separation:left` of a protected lane is `bollard`, `flex_post`, ...
   */
  choices?: readonly string[]
}

export interface PlannedChange {
  key: string
  from: string
  to: string
  code: PlanReasonCode
  params?: Record<string, string>
  reason?: string
  reasonCode?: TagReasonCode
  /** Values the mapper can pick instead of `to`, see `PlannedAdd.choices` */
  choices?: readonly string[]
}

export const PLAN_CONFLICT_CODES = [
  'geometry_bicycle_road_on_sidewalk',
  'geometry_lane_needs_road',
  'geometry_bus_lane_needs_road',
  'geometry_crossing_on_sidewalk',
  'geometry_pedestrian_area_needs_pedestrian',
  /** a path category on the centerline of a road: plan it for a road side instead */
  'geometry_path_needs_road_side',
  /** a lane category on the centerline of a road: plan it for a road side instead */
  'geometry_lane_needs_road_side',
  /** a category of the road itself or of a way of its own (bicycle road, link, crossing) on a road side */
  'geometry_not_a_road_side',
  /** `*_isolated` on a road side: a road side always runs along the road */
  'geometry_isolated_not_a_road_side',
  /** a mapping target for a way of its own (two lines) planned for a road side */
  'geometry_needs_separate_way',
  /** `planForMappingChoice` with a kind that is not in `MAPPING_KINDS` */
  'unknown_mapping_kind',
  /** the planned tags still classify as another category; `params.target`, `params.result` */
  'tags_not_enough',
  /** no tags could be derived for the target; `params.target`, `params.result` */
  'no_suggestion',
  /**
   * the category is reached but the side keeps another lifecycle (an existing lifecycle wins);
   * `params.lifecycle`, `params.result`
   */
  'lifecycle_not_reached',
] as const

export type PlanConflictCode = (typeof PLAN_CONFLICT_CODES)[number]

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
  /** The mapping choice this plan reaches (`mappingChoiceId`), if it was planned for one */
  choiceId?: string
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
  // A protected cycle lane can also be a way of its own (`highway=cycleway`, `is_sidepath=yes`)
  const protectedOwnWay = target === 'cyclewayOnHighwayProtected' && tags.highway === 'cycleway'
  if (
    (target.startsWith('cyclewayOnHighway') || target === 'sharedMotorVehicleLane') &&
    !isCarriageway(tags) &&
    !protectedOwnWay
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
  plan: {
    add: readonly { key: string; value: string }[]
    change: readonly { key: string; to: string }[]
    remove?: readonly string[]
  },
): OsmTags {
  const next = { ...tags }
  for (const key of plan.remove ?? []) delete next[key]
  for (const entry of plan.change) next[entry.key] = entry.to
  for (const entry of plan.add) next[entry.key] ??= entry.value
  return next
}

/**
 * The category TILDA reads for one side of the way. A road side can have two results (the
 * `cycleway:<side>` and the `sidewalk:<side>` object); with `target` the one that category lives on
 * (`sidewalk` for `footwayBicycleYes_*`), else the first.
 */
export function categoryForSide(
  tags: OsmTags,
  side: ResultSide,
  target?: string,
): string | undefined {
  return resultForSide(tags, side, target)?.category
}

function resultForSide(tags: OsmTags, side: ResultSide, target?: string) {
  const ofSide = processBikelanes(tags).filter((result) => result._side === side)
  const prefix = categorySidePrefix(target ?? '')
  const preferred = side === 'self' ? undefined : ofSide.find((r) => r._prefix === prefix)
  return preferred ?? ofSide[0]
}

/** The lifecycle TILDA gives the result of `categoryForSide` (`construction`, `temporary`, ...) */
export function lifecycleForSide(
  tags: OsmTags,
  side: ResultSide,
  target?: string,
): string | undefined {
  return resultForSide(tags, side, target)?.lifecycle ?? undefined
}

function withSuggestions(
  plan: CategoryTagPlan,
  suggestions: { key: string; value: string }[],
  tags: OsmTags,
  side: ResultSide,
): { add: PlannedAdd[]; change: PlannedChange[] } {
  const planned = new Set([...plan.add.map((e) => e.key), ...plan.change.map((e) => e.key)])
  const add: PlannedAdd[] = plan.add.map(fromCoreAdd)
  const change: PlannedChange[] = plan.change.map(fromCoreChange)

  for (const suggestion of suggestions) {
    const key = writeKeyForSide(suggestion.key, side, 'cycleway')
    if (planned.has(key)) continue
    const current = tags[key]
    if (current === undefined) {
      add.push({ key, value: suggestion.value, code: 'macro_suggestion' })
    } else if (current !== suggestion.value) {
      change.push({ key, from: current, to: suggestion.value, code: 'macro_suggestion' })
    }
    planned.add(key)
  }
  return { add, change }
}

/**
 * The wrapper's code for a core entry: the side setup and the fixed tags of a mapping target keep
 * their own code (with the core's parameters), the rest is `category_requirement` with the core's
 * text and code.
 */
function whyOf(entry: TagPlanEntry | CategoryTagPlan['change'][number]) {
  const params = entry.reasonParams ? { params: entry.reasonParams } : {}
  switch (entry.reasonCode) {
    case 'split_both_sides':
    case 'side_presence':
      return { code: entry.reasonCode, ...params }
    case 'fixed_by_mapping_target':
      return { code: 'mapping_target' as const }
    default:
      return {
        code: 'category_requirement' as const,
        reason: entry.reason,
        reasonCode: entry.reasonCode,
        ...params,
      }
  }
}

const choicesOf = (entry: TagPlanEntry | CategoryTagPlan['change'][number]) =>
  entry.choices ? { choices: entry.choices } : {}

const fromCoreAdd = (entry: TagPlanEntry): PlannedAdd => ({
  key: entry.key,
  value: entry.value,
  ...whyOf(entry),
  ...choicesOf(entry),
})

const fromCoreChange = (entry: CategoryTagPlan['change'][number]): PlannedChange => ({
  key: entry.key,
  from: entry.from,
  to: entry.to,
  ...whyOf(entry),
  ...choicesOf(entry),
})

type VariantIds = { choiceId?: string }

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
    currentCategoryId: categoryForSide(tags, side, target) ?? null,
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
  lifecycle?: PlanLifecycle,
): CategoryChangePlan {
  const mismatch = categoryGeometryMismatch(tags, target, side)
  if (mismatch) return conflictPlan(tags, target, side, geometryConflict(tags, mismatch), ids)

  const fixedKeys = Object.keys(fixed)
  const base = planTagsForCategory(tags, target, {
    ...(side === 'self' ? {} : { side }),
    ...(fixedKeys.length ? { fixed: { ...fixed } } : {}),
    ...(lifecycle ? { lifecycle } : {}),
  })
  // On a road side `highway` would retag the whole road, and the core sets the presence key
  // (`cycleway:<side>`) itself: both suggestions are for separate ways only.
  const suggestions = MACRO_CATEGORY_SUGGESTIONS[target]?.filter(
    (entry) => side === 'self' || (entry.key !== 'highway' && entry.key !== 'cycleway'),
  )
  const { add, change } = suggestions
    ? withSuggestions(base, suggestions, applyCategoryPlan(tags, base), side)
    : { add: base.add.map(fromCoreAdd), change: base.change.map(fromCoreChange) }

  const plan: CategoryChangePlan = {
    ...ids,
    targetCategoryId: target,
    currentCategoryId: base.currentCategoryId,
    aligned: base.aligned,
    add,
    change,
    remove: base.remove,
    conflicts: [],
  }
  const next = applyCategoryPlan(tags, plan)
  const result = categoryForSide(next, side, target)
  const resultLifecycle = lifecycle && lifecycleForSide(next, side, target)
  if (result === target && resultLifecycle === lifecycle) return { ...plan, aligned: true }
  if (result === target && lifecycle) {
    return {
      ...plan,
      aligned: false,
      conflicts: [
        {
          code: 'lifecycle_not_reached',
          key: 'lifecycle',
          value: resultLifecycle ?? 'none',
          params: { lifecycle, result: resultLifecycle ?? 'none' },
        },
      ],
    }
  }

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
            params: { target, result: result ?? 'none' },
          }
        : {
            code: 'no_suggestion',
            key: 'category',
            value: result ?? 'none',
            params: { target, result: result ?? 'none' },
          },
    ],
  }
}

/**
 * The plan to reach a mapping choice on `side` of the way: the TILDA category of the choice with
 * its tags (`traffic_sign=DE:240`, `traffic_sign=none` + `segregated=no`, two lines) and its
 * lifecycle. Options the kind does not offer on `side` are left out (`normalizeMappingChoice`).
 */
export function planForMappingChoice(
  tags: OsmTags,
  choice: MappingChoice,
  side: ResultSide,
): CategoryChangePlan {
  const resolved = resolveMappingChoice(choice, side)
  if (!resolved) {
    return conflictPlan(
      tags,
      choice.kind,
      side,
      { code: 'unknown_mapping_kind', key: 'kind', value: choice.kind },
      { choiceId: mappingChoiceId(choice) },
    )
  }
  // two lines: the footway may already be tagged on the left of the cycleway; TILDA reads both sides
  const fixed = { ...resolved.fixed }
  if (
    fixed['traffic_mode:right'] === 'foot' &&
    tags['traffic_mode:left'] === 'foot' &&
    tags['traffic_mode:right'] !== 'foot'
  ) {
    delete fixed['traffic_mode:right']
    fixed['traffic_mode:left'] = 'foot'
  }
  return planOne(
    tags,
    resolved.categoryId,
    side,
    fixed,
    { choiceId: resolved.id },
    resolved.lifecycle,
  )
}

/**
 * Tags to add, change or remove so that `side` of the way gets `target`: fewest edits, no new
 * traffic sign, `traffic_sign=none` kept. Conflicts explain why a target cannot be reached.
 */
export function planCategoryChange(
  tags: OsmTags,
  target: string,
  side: ResultSide,
): CategoryChangePlan {
  return planOne(tags, target, side, {}, {})
}
