/**
 * Port of topics/roads_bikelanes/bikelanes/bikelane_todo_categories.lua (tilda-geo `develop`,
 * 2026-11-11) plus `unexpected_oneway_direction` of the branch `claude/tilda-oneway-processing-81b448`
 * (`5779b5419`, `d9430c2fe`; tilda-geo-private#34, not merged yet).
 *
 * A todo is a reason why a bikelane feature is not tagged well enough. They are derived from the
 * transformed tags of the feature and its result (category, width, surface, oneway), exactly like in LUA.
 *
 * Not ported, because they need data that is not an OSM tag:
 * - the `*__mapillary` variants and the Mapillary priority (`mapillary_coverage` pseudo tag),
 * - `currentness_too_old` (object timestamp),
 * - `adjoining_of_vs_csv` (sidepath CSV).
 * The priority (`prio1` .. `prio3`) is not ported for the same reason.
 */
import { isCrossingPattern } from '../categories/predicates.ts'
import { sanitizeTrafficSign } from '../helpers/sanitize-traffic-sign.ts'
import { containsSubstring, hasTagWithPrefix } from '../helpers/strings.ts'
import type { ImplicitOneWayConfidence, OsmTags } from '../types.ts'

/** What the todo conditions read besides the transformed tags (LUA `result_tags`). */
export interface BikelaneTodoResult {
  category: string
  width?: number | null
  surface?: string | null
  surface_source?: string | null
  oneway?: string
  implicitOneWayConfidence: ImplicitOneWayConfidence
}

/** Proposed tag change of a todo, for editors and MapRoulette Tag Fix tasks. */
export interface TodoTagFix {
  unset: string[]
}

export interface BikelaneTodoDefinition {
  id: string
  desc: string
  /** `true`: hidden from the inspector, only in the todo table. */
  todoTableOnly: boolean
  condition: (tags: OsmTags, result: BikelaneTodoResult) => boolean
  tagFix?: (tags: OsmTags, result: BikelaneTodoResult) => TodoTagFix | undefined
}

// === Bicycle roads ===
const missingTrafficSignVehicleDestination: BikelaneTodoDefinition = {
  id: 'missing_traffic_sign_vehicle_destination',
  desc: "Expecting tag traffic_sign 'Anlieger frei' `traffic_sign=DE:244.1,1020-30` or similar.",
  todoTableOnly: true,
  condition: (tags) =>
    tags.bicycle_road === 'yes' &&
    (tags.vehicle === 'destination' || tags.motor_vehicle === 'destination') &&
    !containsSubstring(tags.traffic_sign, '1020-30'),
}

// Note: we ignore the misstagging of `motor_vehicle` instead of `vehicle` (as in LUA).
const missingTrafficSign244: BikelaneTodoDefinition = {
  id: 'missing_traffic_sign_244',
  desc: 'Expecting tag `traffic_sign=DE:244.1` or similar.',
  todoTableOnly: true,
  condition: (tags, result) =>
    tags.bicycle_road === 'yes' &&
    !containsSubstring(tags.traffic_sign, '244') &&
    !missingTrafficSignVehicleDestination.condition(tags, result),
}

const missingAccessTagBicycleRoad: BikelaneTodoDefinition = {
  id: 'missing_access_tag_bicycle_road',
  desc: 'Expected access tag `bicycle=designated` that is required for routing.',
  todoTableOnly: false,
  // Only check `vehicle` because `motor_vehicle` does allow `bicycle` already.
  condition: (tags) =>
    tags.bicycle_road === 'yes' &&
    (tags.vehicle === 'no' || tags.vehicle === 'destination') &&
    tags.bicycle !== 'designated',
}

// === Traffic signs ===
const malformedTrafficSign: BikelaneTodoDefinition = {
  id: 'malformed_traffic_sign',
  desc: 'Traffic sign tag needs cleaning up.',
  todoTableOnly: true,
  // Compare raw with sanitized tag.
  condition: (tags) =>
    ['traffic_sign', 'traffic_sign:both', 'traffic_sign:forward', 'traffic_sign:backward'].some(
      (key) => tags[key] !== sanitizeTrafficSign(tags[key]),
    ),
}

const missingTrafficSign: BikelaneTodoDefinition = {
  id: 'missing_traffic_sign',
  desc: 'Expected tag `traffic_sign=DE:*` or `traffic_sign=none`.',
  todoTableOnly: true,
  condition: (tags, result) => {
    const trafficSign =
      tags.traffic_sign ?? tags['traffic_sign:forward'] ?? tags['traffic_sign:backward']
    return (
      trafficSign === undefined &&
      // Add any new missing_traffic_sign_* here so we only trigger this todo when no other
      // traffic_sign todo is present.
      !(
        missingTrafficSign244.condition(tags, result) ||
        missingTrafficSignVehicleDestination.condition(tags, result)
      ) &&
      result.category !== 'cyclewayLink' &&
      result.category !== 'crossing' &&
      result.category !== 'needsClarification'
    )
  },
}

// === Bike- and foot path ===
const missingAccessTag240: BikelaneTodoDefinition = {
  id: 'missing_access_tag_240',
  desc: 'Expected tag `bicycle=designated` and `foot=designated`.',
  todoTableOnly: false,
  condition: (tags) =>
    (containsSubstring(tags.traffic_sign, '240') || containsSubstring(tags.traffic_sign, '241')) &&
    // either one missing (tilda-geo 61252e31f; before, only when both were missing)
    (tags.bicycle !== 'designated' || tags.foot !== 'designated') &&
    tags.cycleway !== 'track' &&
    tags.cycleway !== 'lane',
}

const SEGREGATED_VALUES = new Set(['yes', 'no'])

const missingSegregated: BikelaneTodoDefinition = {
  id: 'missing_segregated',
  desc: 'Expected tag `segregated=yes` or `segregated=no`.',
  todoTableOnly: false,
  condition: (tags, result) =>
    result.category === 'needsClarification' &&
    // neither `yes` nor `no` (tilda-geo ed8478350)
    !SEGREGATED_VALUES.has(tags.segregated ?? '') &&
    ((tags.bicycle === 'designated' && tags.foot === 'designated') ||
      containsSubstring(tags.traffic_sign, '240') ||
      containsSubstring(tags.traffic_sign, '241')),
}

const unexpectedBicycleAccessOnFootway: BikelaneTodoDefinition = {
  id: 'unexpected_bicycle_access_on_footway',
  desc:
    'Expected `highway=path+bicycle=designated` (unsigned/explicit DE:240) ' +
    'or `highway=footway+bicycle=yes` (unsigned/explicit DE:239,1022-10); ' +
    'Add traffic_sign=none to specify unsigned path.',
  todoTableOnly: true,
  condition: (tags, result) =>
    tags.highway === 'footway' &&
    tags.bicycle === 'designated' &&
    result.category === 'needsClarification',
}

const EXCLUDED_SURFACES = new Set([
  'ground',
  'dirt',
  'fine_gravel',
  'gravel',
  'pebblestone',
  'earth',
])

const unexpectedHighwayPath: BikelaneTodoDefinition = {
  id: 'unexpected_highway_path',
  desc: 'Expected `highway=cycleway` (unsigned/explicit DE:237)',
  todoTableOnly: true,
  // REFERENCE: See conditions in the `needsClarification` category.
  condition: (tags) =>
    tags.highway === 'path' &&
    tags.bicycle === 'designated' &&
    tags.foot === 'no' &&
    !(
      hasTagWithPrefix(tags, 'mtb:') ||
      tags.mtb === 'yes' ||
      (tags.surface !== undefined && EXCLUDED_SURFACES.has(tags.surface))
    ),
}

// === Infrastructure ===
const crossingTooLong: BikelaneTodoDefinition = {
  id: 'crossing_too_long',
  desc: 'Crossing longer than 100 m, guidance form unclear. Please review and correct.',
  todoTableOnly: false,
  condition: (tags, result) =>
    result.category === 'needsClarification' &&
    isCrossingPattern(tags) &&
    tags._length != null &&
    tags._length > 100,
}

const needsClarification: BikelaneTodoDefinition = {
  id: 'needs_clarification',
  desc: 'Tagging insufficient to categorize the bike infrastructure.',
  todoTableOnly: false,
  condition: (tags, result) =>
    result.category === 'needsClarification' &&
    !(
      tags.cycleway === 'shared' || // Handled by the road todo `deprecated_cycleway_shared`
      unexpectedBicycleAccessOnFootway.condition(tags, result) ||
      crossingTooLong.condition(tags, result) ||
      missingSegregated.condition(tags, result)
    ),
}

// Name is not precise anymore since we only include one sub-category here.
const adjoiningOrIsolated: BikelaneTodoDefinition = {
  id: 'adjoining_or_isolated',
  desc: 'Only for category=cycleway_adjoiningOrIsolated for now. Expected tag `is_sidepath=yes` or `is_sidepath=no`.',
  todoTableOnly: false,
  condition: (_tags, result) => result.category === 'cycleway_adjoiningOrIsolated',
}

const advisoryOrExclusive: BikelaneTodoDefinition = {
  id: 'advisory_or_exclusive',
  desc: 'Expected tag `cycleway:*:lane=advisory` or `exclusive`.',
  todoTableOnly: false,
  condition: (_tags, result) => containsSubstring(result.category, '_advisoryOrExclusive'),
}

const needsClarificationTrack: BikelaneTodoDefinition = {
  id: 'needs_clarification_track',
  desc: 'Tagging `cycleway=track` insufficient to categorize the bike infrastructure`.',
  todoTableOnly: false,
  condition: (tags, result) => {
    if (result.category === 'cyclewayOnHighwayProtected') return false
    if (tags._parent == null) return false

    // The side object already holds its own side's tags (`cycleway:SIDE:*` > `cycleway:both:*` >
    // `cycleway:*`), so `segregated` and `traffic_sign` here are the values of this side only
    // (tilda-geo 48b04faf5).
    if (tags.segregated === 'yes' || tags.segregated === 'no') return false
    // A traffic sign settles what the track is, so `segregated` is not needed:
    if (containsSubstring(tags.traffic_sign, '237')) return false // DE:237 Radweg (bicycles only)
    if (containsSubstring(tags.traffic_sign, '240')) return false // DE:240 shared foot and cycle path
    if (containsSubstring(tags.traffic_sign, '241')) return false // DE:241 segregated foot and cycle path

    return tags.cycleway === 'track'
  },
}

const mixedCyclewayBoth: BikelaneTodoDefinition = {
  id: 'mixed_cycleway_both',
  desc: 'Mixed tagging of cycleway=* or cycleway:both=* with cycleway:SIDE',
  todoTableOnly: false,
  condition: (tags) => {
    const parent = tags._parent as OsmTags | undefined
    if (parent == null) return false
    // NOTE: This also triggers on 'no' values. The mix of 'both' and 'SIDE' is still not ideal.
    const hasSide = parent['cycleway:left'] !== undefined || parent['cycleway:right'] !== undefined
    return (
      (parent['cycleway:both'] !== undefined && hasSide) ||
      (parent.cycleway !== undefined && hasSide)
    )
  },
}

// === Other ===
const MAX_USUAL_WIDTH = 50
const REVIEWED_KEYS = [
  'check_date',
  'check_date:width',
  'survey:date',
  'survey:date:width',
  'survey_date',
]

function hasReviewedKey(tags: OsmTags | undefined): boolean {
  if (tags == null) return false
  return REVIEWED_KEYS.some((key) => tags[key] !== undefined)
}

/**
 * Port of is_unusual_width.lua: a `width` a human should look at. Not readable by `parseWidth`
 * (`narrow`, `1-2`, `-1`, `0`), or above 50 m (published, but probably a typo). A check date on the
 * way, on the road of a lane, or on the width itself closes the todo.
 */
export function isUnusualWidth(tags: OsmTags, result: Pick<BikelaneTodoResult, 'width'>): boolean {
  if (tags.width === undefined) return false
  if (hasReviewedKey(tags) || hasReviewedKey(tags._parent)) return false
  return result.width == null || result.width > MAX_USUAL_WIDTH
}

const missingWidth: BikelaneTodoDefinition = {
  id: 'missing_width',
  desc: 'Ways without `width`',
  todoTableOnly: true,
  condition: (_tags, result) =>
    result.width == null &&
    result.category !== 'cyclewayLink' &&
    result.category !== 'crossing' &&
    result.category !== 'pedestrianAreaBicycleYes' &&
    result.category !== 'needsClarification' &&
    !containsSubstring(result.category, 'cyclewayOnHighway') &&
    !containsSubstring(result.category, 'sharedBusLane'),
}

const unusualWidth: BikelaneTodoDefinition = {
  id: 'unusual_width',
  desc: 'Width that we cannot read or that is unusually high. Fix `width`, or confirm it with `check_date=*` or `check_date:width=*`.',
  todoTableOnly: true,
  condition: (tags, result) => isUnusualWidth(tags, result),
}

const missingSurface: BikelaneTodoDefinition = {
  id: 'missing_surface',
  desc: 'Ways without `surface`',
  todoTableOnly: true,
  // Either the surface is missing. But also surface values that are not derived from the osm tag
  // should be added.
  condition: (_tags, result) =>
    (result.surface == null || result.surface_source !== 'tag') &&
    result.category !== 'cyclewayLink' &&
    result.category !== 'needsClarification' &&
    !containsSubstring(result.category, 'cyclewayOnHighway') &&
    !containsSubstring(result.category, 'sharedBusLane'),
}

const missingOneway: BikelaneTodoDefinition = {
  id: 'missing_oneway',
  desc: 'Ways without explicit `oneway`',
  todoTableOnly: false,
  condition: (tags, result) => {
    // Skip if the 'track' campaign is present
    if (needsClarificationTrack.condition(tags, result)) return false
    if (needsClarification.condition(tags, result)) return false
    // Lanes and tracks tagged on the road have a documented default direction per side;
    // "Adding these defaults is unnecessary tagging" (tilda-geo `6ec40d600`).
    if (tags._parent != null) return false
    // We rely on the category's `implicitOneWayConfidence`, but some infrastructure is not
    // relevant enough for now:
    if (result.category === 'crossing') return false
    if (result.category === 'cyclewayLink') return false
    if (!(result.oneway === 'assumed_no' || result.oneway === 'implicit_yes')) return false
    return result.implicitOneWayConfidence === 'low'
  },
}

/**
 * `cycleway:<side>:oneway` is relative to the drawing direction of the way. On a road that is not
 * oneway, `yes` on the left and `-1` on the right mean riding against the traffic of that side.
 * That is rarely real and mostly a mix-up of "one direction" with "direction of the way".
 * On oneway roads both directions are plausible on the left (contraflow or not), so we skip them.
 * (branch `claude/tilda-oneway-processing-81b448`, tilda-geo-private#34, not merged yet)
 */
// Values after `normalizeOnewayTags` (`1` is `yes`).
const AGAINST_SIDE_TRAFFIC: Record<'left' | 'right', ReadonlySet<string>> = {
  left: new Set(['yes']),
  right: new Set(['-1']),
}

/**
 * Keys on the road that tag a lane against the traffic of its side, per side.
 * A `:both:` or unsided key covers both sides unless the side has its own key.
 */
function againstSideTrafficKeys(tags: OsmTags): Partial<Record<'left' | 'right', string>> {
  const parent = tags._parent as OsmTags
  const prefix = tags._prefix
  const bothKey = `${prefix}:both:oneway`
  const unsidedKey = `${prefix}:oneway`
  const sharedKey =
    parent[bothKey] !== undefined
      ? bothKey
      : parent[unsidedKey] !== undefined
        ? unsidedKey
        : undefined
  const keys: Partial<Record<'left' | 'right', string>> = {}
  for (const side of ['left', 'right'] as const) {
    const against = AGAINST_SIDE_TRAFFIC[side]
    const sideKey = `${prefix}:${side}:oneway`
    const sideValue = parent[sideKey]
    if (sideValue !== undefined) {
      if (against.has(sideValue)) keys[side] = sideKey
    } else if (sharedKey !== undefined && against.has(parent[sharedKey] as string)) {
      keys[side] = sharedKey
    }
  }
  return keys
}

const unexpectedOnewayDirection: BikelaneTodoDefinition = {
  id: 'unexpected_oneway_direction',
  desc: 'Lane or track tagged to run against the traffic of its side (`cycleway:left:oneway=yes`, `cycleway:both:oneway=yes`, `cycleway:right:oneway=-1`).',
  todoTableOnly: false,
  condition: (tags) => {
    const parent = tags._parent as OsmTags | undefined
    if (parent == null) return false
    // The defaults are documented for `cycleway:*` only, not for `sidewalk:*`.
    if (tags._prefix !== 'cycleway') return false
    // Roundabouts are `oneway=yes` after `normalizeOnewayTags`.
    if (parent.oneway === 'yes' || parent.oneway === '-1') return false
    // A check date on the lane confirms an unusual direction, like `unusual_width`:
    // `cycleway:<side>:check_date:oneway=*` or `cycleway:<side>:check_date=*` (also `:both:`).
    if (tags['check_date:oneway'] != null || tags.check_date != null) return false

    const keys = againstSideTrafficKeys(tags)
    for (const side of ['left', 'right'] as const) {
      const key = keys[side]
      if (key === undefined) continue
      // A key that covers both sides gives both sides the same todo (and `todos_lines` keeps one row).
      if (side === tags._side || !key.includes(`:${side}:`)) return true
    }
    return false
  },
  // Removing the tag restores the default direction of the side. Only proposed for the left side:
  // `yes` there is the usual mix-up of "one direction" with "direction of the way".
  // The same list on both sides of a way, so MapRoulette gets one task per way.
  tagFix: (tags) => {
    const keys = againstSideTrafficKeys(tags)
    if (keys.left === undefined || keys.right !== undefined) return undefined
    return { unset: [keys.left] }
  },
}

/** In the order of `bikelane_todo_categories` in LUA. */
export const BIKELANE_TODOS: readonly BikelaneTodoDefinition[] = [
  // Infrastructure
  crossingTooLong,
  needsClarification,
  adjoiningOrIsolated,
  advisoryOrExclusive,
  needsClarificationTrack,
  mixedCyclewayBoth,
  unexpectedHighwayPath,
  // Bicycle roads
  missingTrafficSignVehicleDestination,
  missingTrafficSign244,
  missingAccessTagBicycleRoad,
  // Traffic signs
  missingTrafficSign,
  malformedTrafficSign,
  // Bike- and foot path
  missingAccessTag240,
  missingSegregated,
  unexpectedBicycleAccessOnFootway,
  // Other
  missingWidth,
  unusualWidth,
  missingSurface,
  missingOneway,
  unexpectedOnewayDirection,
]

export interface BikelaneTodos {
  /** Ids of the todos that apply, in the order of `BIKELANE_TODOS`. */
  todos: string[]
  /** Proposed tag changes per todo id; only set when a todo proposes one. */
  todoTagFixes?: Record<string, TodoTagFix>
}

/**
 * `tags` are the transformed tags after categorization (the category's `process` may have changed
 * them), `result` what was derived for the feature.
 */
export function deriveBikelaneTodos(tags: OsmTags, result: BikelaneTodoResult): BikelaneTodos {
  const todos: string[] = []
  let todoTagFixes: Record<string, TodoTagFix> | undefined
  for (const todo of BIKELANE_TODOS) {
    if (!todo.condition(tags, result)) continue
    todos.push(todo.id)
    const fix = todo.tagFix?.(tags, result)
    if (fix) {
      todoTagFixes ??= {}
      todoTagFixes[todo.id] = fix
    }
  }
  return todoTagFixes ? { todos, todoTagFixes } : { todos }
}
