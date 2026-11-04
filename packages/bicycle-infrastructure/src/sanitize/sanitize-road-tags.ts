import { parseLength } from '../helpers/parse-length.ts'
import { sanitizeForLogging } from '../helpers/sanitize-for-logging.ts'
/** Port of topics/roads_bikelanes/helper/sanitize_road_tags.lua */
import type { OsmTags, Side } from '../types.ts'

/**
 * `separation` values that make a lane "protected" (`cyclewayOnHighwayProtected`), as in
 * `bikelane_categories.lua`. Other allowed values (`kerb`, `greenery`, ...) do not.
 */
export const PROTECTIVE_SEPARATION = [
  'bollard',
  'flex_post',
  'vertical_panel',
  'studs',
  'bump',
  'planter',
  'fence',
  'jersey_barrier',
  'guard_rail',
] as const

export const SEPARATION_ALLOWED = [
  'no',
  'bollard',
  'flex_post',
  'vertical_panel',
  'studs',
  'bump',
  'planter',
  'kerb',
  'fence',
  'jersey_barrier',
  'guard_rail',
  'structure',
  'ditch',
  'greenery',
  'hedge',
  'tree_row',
  'cone',
  'kerb;parking_lane',
  'kerb;bollard',
  'yes',
] as const

export const MARKING_ALLOWED = [
  'solid_line',
  'dashed_line',
  'double_solid_line',
  'barred_area',
  'pictogram',
  'surface',
] as const

export const TRAFFIC_MODE_ALLOWED = [
  'no',
  'motor_vehicle',
  'parking',
  'psv',
  'bicycle',
  'foot',
] as const

export const SURFACE_COLOR_ALLOWED = ['red', 'green', 'red;green', 'no'] as const

/** Read `<base>:<side>` → `<base>:both` → (left only) `<base>` (mirrors LUA exactly). */
function sided(tags: OsmTags, base: string, side: Side): string | undefined {
  let value = tags[`${base}:${side}`] ?? tags[`${base}:both`]
  if (side === 'left') value = value ?? tags[base]
  return value
}

export function surfaceColor(tags: OsmTags): string | undefined {
  const raw = tags['surface:colour'] ?? tags['surface:color']
  if (raw == null) return undefined
  const transformations: Record<string, string> = {
    none: 'no',
    grey: 'no',
    gray: 'no',
    '#888888': 'no',
    silver: 'no',
    dimgray: 'no',
    '#b5565a': 'red',
    orange: 'red',
    'green;red': 'red;green',
  }
  const value = transformations[raw] ?? raw
  return sanitizeForLogging(value, SURFACE_COLOR_ALLOWED)
}

export function separation(tags: OsmTags, side: Side): string | undefined {
  const raw = sided(tags, 'separation', side)
  if (raw == null) return undefined
  const transformations: Record<string, string> = {
    separation_kerb: 'bump',
    lane_separator: 'bump',
    surface: 'no',
    'tree_row;kerb': 'tree_row',
    'kerb;tree_row': 'tree_row',
    'tree_row;kerb;parking_lane': 'tree_row',
    'grass_verge;tree_row': 'tree_row',
    'kerb;greenery': 'kerb',
    'parking_lane;kerb': 'parking_lane',
    'solid_line;parking_lane': 'parking_lane',
  }
  const value = transformations[raw] ?? raw
  return sanitizeForLogging(value, SEPARATION_ALLOWED)
}

export function marking(tags: OsmTags, side: Side): string | undefined {
  const raw = sided(tags, 'marking', side)
  if (raw == null) return undefined
  return sanitizeForLogging(raw, MARKING_ALLOWED)
}

export function trafficMode(tags: OsmTags, side: Side): string | undefined {
  const raw = sided(tags, 'traffic_mode', side)
  if (raw == null) return undefined
  const transformations: Record<string, string> = {
    'foot;bicycle': 'foot',
    motorized: 'motor_vehicle',
    none: 'no',
  }
  const value = transformations[raw] ?? raw
  return sanitizeForLogging(value, TRAFFIC_MODE_ALLOWED)
}

export function buffer(tags: OsmTags, side: Side): number | undefined {
  const raw = sided(tags, 'buffer', side)
  if (raw == null) return undefined
  if (raw === 'no' || raw === 'none') return 0
  return parseLength(raw)
}

export function temporary(tags: OsmTags): string | undefined {
  if (tags.temporary === 'yes') return 'temporary'
  return undefined
}

/** Map of sided sanitizers keyed by their base name (used by the decision view). */
export const SIDED_SANITIZERS: Record<
  string,
  (tags: OsmTags, side: Side) => string | number | undefined
> = {
  separation,
  marking,
  traffic_mode: trafficMode,
  buffer,
}
