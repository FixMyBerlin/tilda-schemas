import {
  MAJOR_ROAD_CLASSES,
  MINOR_ROAD_CLASSES,
  TRUNK_MOTORWAY_CLASSES,
  planTagsForCategory,
  processBikelanes,
  type CategoryTagPlan,
  type TagPlanEntry,
} from '@tilda-geo/bicycle-infrastructure'
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
 * One way to reach the target. The planner returns a list of these (`planCategoryVariants`), today
 * with one entry, so later variants (with / without a traffic sign) do not change the shape.
 */
export interface CategoryChangePlan {
  /** `default` for the first variant */
  variantId: string
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
  sharedMotorVehicleLane: 'shared_lane',
  sharedBusLaneBusWithBike: 'share_busway',
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
): PlanConflictCode | undefined {
  if (target.startsWith('bicycleRoad') && isSidewalkFootway(tags)) {
    return 'geometry_bicycle_road_on_sidewalk'
  }
  if (target.startsWith('cyclewayOnHighway') && !isCarriageway(tags)) {
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

function conflictPlan(
  tags: OsmTags,
  target: string,
  side: ResultSide,
  conflict: PlanConflict,
): CategoryChangePlan {
  return {
    variantId: 'default',
    targetCategoryId: target,
    currentCategoryId: categoryForSide(tags, side) ?? null,
    aligned: false,
    add: [],
    change: [],
    remove: [],
    conflicts: [conflict],
  }
}

/**
 * The ways to reach `target` on `side` of the way, the preferred one first. Today there is one
 * variant (`default`); variants such as "with sign" / "without sign" are added as further entries.
 */
export function planCategoryVariants(
  tags: OsmTags,
  target: string,
  side: ResultSide,
): CategoryChangePlan[] {
  const mismatch = categoryGeometryMismatch(tags, target)
  if (mismatch) {
    return [
      conflictPlan(tags, target, side, {
        code: mismatch,
        key: tags.highway ? 'highway' : 'category',
        value: tags.highway ?? 'none',
        params: tags.highway ? { highway: tags.highway } : undefined,
      }),
    ]
  }

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

  const base = planTagsForCategory(working, target, side === 'self' ? undefined : { side })
  // On a road side `highway` would retag the whole road, and the presence key (`cycleway`) is set
  // above as `cycleway:<side>`: both are for separate ways only.
  const suggestions = MACRO_CATEGORY_SUGGESTIONS[target]?.filter(
    (entry) => side === 'self' || (entry.key !== 'highway' && entry.key !== 'cycleway'),
  )
  const library = suggestions
    ? withSuggestions(base, suggestions, working)
    : { add: base.add.map(fromCoreAdd), change: base.change.map(fromCoreChange) }

  for (const entry of library.add) {
    const key = sideKey(entry.key, side)
    if (working[key] === undefined && !add.some((existing) => existing.key === key)) {
      add.push({ ...entry, key })
    }
  }
  for (const entry of library.change) {
    const key = sideKey(entry.key, side)
    if (working[key] !== entry.to) change.push({ ...entry, key, from: working[key] ?? entry.from })
  }

  const plan: CategoryChangePlan = {
    variantId: 'default',
    targetCategoryId: target,
    currentCategoryId: base.currentCategoryId,
    aligned: base.aligned,
    add,
    change,
    remove: split.remove,
    conflicts: [],
  }
  const result = categoryForSide(applyCategoryPlan(tags, plan), side)
  if (result === target) return [{ ...plan, aligned: true }]

  const hasEdits = add.length > 0 || change.length > 0 || plan.remove.length > 0
  return [
    {
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
    },
  ]
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
  return planCategoryVariants(tags, target, side)[0]!
}
