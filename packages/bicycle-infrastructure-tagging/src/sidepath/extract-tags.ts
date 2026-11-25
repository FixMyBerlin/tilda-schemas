import {
  BIKELANE_TRANSFORMATIONS,
  defaultSideRunsAgainstWay,
  getTransformedObjects,
  parseWidth,
  processBikelanes,
  highwayClass,
  isUnderConstruction,
} from '@tilda-geo/bicycle-infrastructure'
import { onewayKey } from '../requirements/required-attributes.ts'
import type { OsmTags } from '../types.ts'
import { misreadSharedOneway } from '../validations/cycleway-oneway.ts'
import { roadWidthFromTags } from '../widths/width-tags.ts'
import {
  combinedPathTags,
  type JoinSigns,
  type SignRecommend,
  withConstruction,
} from './merge-tags.ts'

export type { SignRecommend }

/**
 * Tag logic for "extract a road side into a separate way".
 * Pure functions: which sides can be extracted, the tags of the new way, the changes on the
 * road, and how far from the centerline the new way goes.
 */

export type Side = 'left' | 'right'
export type SidepathPrefix = 'cycleway' | 'sidewalk'
/** `cycleway`: cycle track or protected lane; `sidewalk`; `path`: both as one foot and cycle path */
export type ExtractVariant = 'cycleway' | 'sidewalk' | 'path'

/** Road classes whose sides can be extracted */
const ROAD_HIGHWAYS = new Set([
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'road',
])

const TRACK_VALUES = new Set(['track', 'opposite_track'])
const LANE_VALUES = new Set(['lane', 'opposite_lane', 'share_busway', 'opposite_share_busway'])
/** Keys of a side object that only make sense on the road */
const ROAD_ONLY_KEY = /(^|:)lanes(:|$)|^lane$/
/** Values of `bicycle` on the road that we may replace with `use_sidepath` */
const REPLACEABLE_BICYCLE = new Set(['yes', 'designated', 'use_sidepath', 'optional_sidepath'])

/** Keys TILDA reads for one side, unnested (`cycleway:right:width` → `width`), without the presence key */
export function sideTags(tags: OsmTags, prefix: SidepathPrefix, side: Side): OsmTags {
  const objects = getTransformedObjects({ ...tags }, BIKELANE_TRANSFORMATIONS)
  const object = objects.find((o) => o._side === side && o._prefix === prefix) ?? {}
  const result: OsmTags = {}
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || typeof value !== 'string') continue
    if (key.startsWith('_') || key === 'highway' || key === prefix || ROAD_ONLY_KEY.test(key))
      continue
    result[key] = value
  }
  return result
}

/** The cycleway value of one side (`cycleway:<side>` → `cycleway:both` → `cycleway`) */
function cyclewayValue(tags: OsmTags, side: Side) {
  return tags[`cycleway:${side}`] ?? tags['cycleway:both'] ?? tags.cycleway
}

/** The sidewalk value of one side, including the old `sidewalk=left|right|both` schema */
export function sidewalkValue(tags: OsmTags, side: Side): string | undefined {
  const sided = tags[`sidewalk:${side}`] ?? tags['sidewalk:both']
  if (sided !== undefined) return sided
  const value = tags.sidewalk
  if (value === 'both' || value === 'yes') return 'yes'
  if (value === 'left' || value === 'right') return value === side ? 'yes' : 'no'
  return value // no, none, separate
}

/**
 * `track`, `protected` (a lane the processing rates as `cyclewayOnHighwayProtected`: its set of
 * `separation` values and `traffic_mode`, not any separation) or `undefined`
 */
export function cyclewayKind(tags: OsmTags, side: Side): 'track' | 'protected' | undefined {
  const value = cyclewayValue(tags, side)
  if (!value) return undefined
  if (value === 'opposite_track') return side === 'left' ? 'track' : undefined
  if (TRACK_VALUES.has(value)) return 'track'
  if (LANE_VALUES.has(value)) {
    const protectedLane = processBikelanes(tags).some(
      (result) => result._side === side && result.category === 'cyclewayOnHighwayProtected',
    )
    return protectedLane ? 'protected' : undefined
  }
  return undefined
}

export type ExtractOption = {
  variant: ExtractVariant
  side: Side
  protectedLane: boolean
  /**
   * A bike lane on the road (`cycleway:<side>=lane`, not a protected lane), only with
   * `extractOptions(tags, { plainLanes: true })`: `line` extracts it as a line along the road,
   * `crossing` as a crossing way
   */
  lane?: 'line' | 'crossing'
  /**
   * The new way is a crossing (`cycleway=crossing`, `path=crossing`): the side is marked as one
   * (`isCrossingSide`) or this is the lane entry `crossing`. Pass it to `planExtraction` as
   * `asCrossing`.
   */
  crossing: boolean
}

export type ExtractOptionsSettings = {
  /**
   * Also offer bike lanes on the road (`cycleway:<side>=lane`, `opposite_lane` on the left), each
   * as a line and as a crossing; a lane marked as a crossing only as a crossing. Off by default:
   * a painted lane usually stays on the road.
   */
  plainLanes?: boolean
}

/** The keys of a side that mark a crossing (`cycleway:right:track=crossing`) */
const CROSSING_MARK_KEYS = ['track', 'lane']

/**
 * The cycle track or lane of this side is marked as a crossing: `cycleway:<side>:track=crossing`
 * or `…:lane=crossing`, also with `:both:` or without a side. It is extracted as a crossing way
 * and never merged with the sidewalk.
 */
export function isCrossingSide(road: OsmTags, side: Side): boolean {
  return CROSSING_MARK_KEYS.some((key) =>
    [`cycleway:${side}:${key}`, `cycleway:both:${key}`, `cycleway:${key}`].some(
      (sideKey) => road[sideKey] === 'crossing',
    ),
  )
}

/** A bike lane on this side that is not a protected lane (`opposite_lane` only on the left) */
function isPlainLaneSide(road: OsmTags, side: Side) {
  const value = cyclewayValue(road, side)
  const lane = value === 'lane' || (value === 'opposite_lane' && side === 'left')
  return lane && cyclewayKind(road, side) === undefined
}

/** What can be extracted from this way, right side first */
export function extractOptions(
  tags: OsmTags,
  settings: ExtractOptionsSettings = {},
): ExtractOption[] {
  if (!ROAD_HIGHWAYS.has(highwayClass(tags) ?? '') || tags.area === 'yes') return []
  const options: ExtractOption[] = []
  const lanes: ExtractOption[] = []
  for (const side of ['right', 'left'] as const) {
    const cycleway = cyclewayKind(tags, side)
    const sidewalk = sidewalkValue(tags, side) === 'yes'
    const crossing = isCrossingSide(tags, side)
    if (cycleway)
      options.push({ variant: 'cycleway', side, protectedLane: cycleway === 'protected', crossing })
    if (sidewalk) options.push({ variant: 'sidewalk', side, protectedLane: false, crossing: false })
    if (cycleway === 'track' && sidewalk)
      options.push({ variant: 'path', side, protectedLane: false, crossing })
    if (settings.plainLanes && isPlainLaneSide(tags, side)) {
      const base = { variant: 'cycleway', side, protectedLane: false } as const
      if (!crossing) lanes.push({ ...base, lane: 'line', crossing: false })
      lanes.push({ ...base, lane: 'crossing', crossing: true })
    }
  }
  // protected lanes are offered, but not recommended: keep them at the end, then the plain lanes
  return [
    ...options.filter((o) => !o.protectedLane),
    ...options.filter((o) => o.protectedLane),
    ...lanes,
  ]
}

/**
 * The sides whose cycle track can be extracted and merged with the sidewalk in one step: never a
 * protected or plain lane (they stay next to the road), never a crossing.
 */
export function extractAndMergeSides(tags: OsmTags): Side[] {
  return extractOptions(tags)
    .filter((o) => o.variant === 'cycleway' && !o.protectedLane && !o.crossing)
    .map((o) => o.side)
}

/** Tags the sign implies for a way: highway (cycleway/path/footway), access and segregated, normalized sign */
function signTags(sign: string | undefined, recommend: SignRecommend | undefined) {
  if (!sign || !recommend || sign === 'none') return {}
  let recommended: Record<string, string | string[]>
  try {
    recommended = recommend(sign)
  } catch {
    return {}
  }
  const result: OsmTags = {}
  const highways = recommended.highway
  const highway = Array.isArray(highways)
    ? highways.find((h) => ['cycleway', 'path', 'footway'].includes(h))
    : undefined
  if (highway) result.highway = highway
  for (const key of ['bicycle', 'foot', 'segregated']) {
    const value = recommended[key]
    if (typeof value === 'string') result[key] = value
  }
  if (typeof recommended.traffic_sign === 'string') result.traffic_sign = recommended.traffic_sign
  return result
}

/**
 * The `oneway` value of the new way's bike traffic. The new way is always drawn in the road's
 * direction, so the side's tags (`separation:left`, `traffic_sign:forward`, ...) stay valid as
 * they are, and a later merge with a sidewalk usually finds both in the same direction.
 * An explicit `cycleway:<side>:oneway` wins (`planExtraction` first resolves a misread
 * `cycleway:both:oneway=yes`, see `resolveSharedOneway`). Else the direction is the one the processing derives
 * (`defaultSideRunsAgainstWay`, tilda-geo `6ec40d600`): with the traffic on that side, so `yes` on
 * the right and `-1` on the left of a two-way road, and `yes` on both sides of a one-way road, also
 * when bicycles may ride against it (a contraflow lane needs an explicit `-1`).
 */
export function cyclewayOneway(
  road: OsmTags,
  side: Side,
  sideOneway: string | undefined,
): 'yes' | '-1' | 'no' {
  if (sideOneway === 'yes' || sideOneway === '-1' || sideOneway === 'no') return sideOneway
  return defaultSideRunsAgainstWay(road, side) ? '-1' : 'yes'
}

/**
 * `cycleway:both:oneway=yes` (or `cycleway:oneway=yes`) where it most likely means "one direction,
 * with the traffic of each side" (`misreadSharedOneway`, common in Berlin) becomes the direction of
 * each side: an explicit value on a track (it says "not both directions") or where it is not the
 * default, nothing on a lane with the default. Other roads are returned as they are.
 */
export function resolveSharedOneway(road: OsmTags): OsmTags {
  const sides = (['left', 'right'] as const).filter(
    (side) => misreadSharedOneway(road, side) !== undefined,
  )
  if (!sides.length) return road
  const result: OsmTags = { ...road }
  const key =
    road['cycleway:both:oneway'] !== undefined ? 'cycleway:both:oneway' : 'cycleway:oneway'
  delete result[key]
  for (const side of ['left', 'right'] as const) {
    const sideKey = `cycleway:${side}:oneway`
    if (road[sideKey] !== undefined) continue
    const value = misreadSharedOneway(road, side) ?? 'yes'
    const track = TRACK_VALUES.has(cyclewayValue(road, side) ?? '')
    if (track || value !== cyclewayOneway(road, side, undefined)) result[sideKey] = value
  }
  return result
}

export type ExtractionPlan = {
  wayTags: OsmTags
  roadTags: OsmTags
  /** meters from the road's centerline */
  offsetMeters: number
  /** `bicycle` on the road was not changed because it has another value */
  keptBicycle: string | undefined
}

/** The side has a cycle track or protected lane (also one already mapped separately) */
function hasTrack(road: OsmTags, side: Side) {
  const value = cyclewayValue(road, side)
  return cyclewayKind(road, side) !== undefined || value === 'separate'
}

/** Distances for `sidepathOffsetMeters`, in meters */
export type SidepathConfig = {
  /** the width of the parking row next to the road, by kind */
  parkingMeters: {
    parallel: number
    diagonal: number
    perpendicular: number
    halfOnKerb: number
    onKerb: number
  }
  /** the kerb between the road (or parking) and the new way */
  kerbMeters: number
  /** used when the track or the sidewalk has no usable `width` */
  defaultTrackWidthMeters: number
  defaultSidewalkWidthMeters: number
}

export const DEFAULT_SIDEPATH_CONFIG: SidepathConfig = {
  parkingMeters: { parallel: 2, diagonal: 4.5, perpendicular: 5, halfOnKerb: 1, onKerb: 2 },
  kerbMeters: 1,
  defaultTrackWidthMeters: 2,
  defaultSidewalkWidthMeters: 2.5,
}

function parkingWidth(road: OsmTags, side: Side, config: SidepathConfig) {
  const parking = road[`parking:${side}`] ?? road['parking:both']
  const orientation = road[`parking:${side}:orientation`] ?? road['parking:both:orientation']
  const meters = config.parkingMeters
  if (parking === 'lane' || parking === 'street_side') {
    return orientation === 'diagonal'
      ? meters.diagonal
      : orientation === 'perpendicular'
        ? meters.perpendicular
        : meters.parallel
  }
  if (parking === 'half_on_kerb') return meters.halfOnKerb
  if (parking === 'on_kerb') return meters.onKerb
  return 0
}

/** Meters from the centerline to the middle of the new way, stacked road → parking → track → sidewalk */
export function sidepathOffsetMeters(
  road: OsmTags,
  side: Side,
  variant: ExtractVariant,
  options: Partial<SidepathConfig> = {},
) {
  const config = { ...DEFAULT_SIDEPATH_CONFIG, ...options }
  const half = roadWidthFromTags(road).meters / 2
  const track = parseWidth(sideTags(road, 'cycleway', side).width) ?? config.defaultTrackWidthMeters
  const sidewalk =
    parseWidth(sideTags(road, 'sidewalk', side).width) ?? config.defaultSidewalkWidthMeters
  const base = half + parkingWidth(road, side, config) + config.kerbMeters

  if (variant === 'cycleway') return base + track / 2
  if (variant === 'path') return base + (track + sidewalk) / 2
  return base + (hasTrack(road, side) ? track : 0) + sidewalk / 2
}

/**
 * Set `key:forward` / `key:backward` like iD's directional combo field: equal values merge
 * into `key`, different values keep both directional keys (the plain value becomes the
 * value of the other direction).
 */
export function setDirectionalValue(
  tags: OsmTags,
  key: string,
  direction: 'forward' | 'backward',
  value: string,
): OsmTags {
  const result = { ...tags }
  const directionalKey = `${key}:${direction}`
  const otherKey = `${key}:${direction === 'forward' ? 'backward' : 'forward'}`
  const otherValue = result[otherKey] ?? result[key]

  if (otherValue === value) {
    result[key] = value
    delete result[directionalKey]
    delete result[otherKey]
  } else {
    result[directionalKey] = value
    if (otherValue !== undefined) result[otherKey] = otherValue
    delete result[key]
  }
  return result
}

/** Keys under `prefix` that belong to the sides (not `cycleway:lanes…`) */
function isSidedSubKey(key: string, prefix: SidepathPrefix) {
  if (!key.startsWith(`${prefix}:`)) return false
  const rest = key.slice(prefix.length + 1)
  return !/^lanes(:|$)/.test(rest)
}

/**
 * Move `prefix` and `prefix:both` (value and sub-keys) to explicit `:left` / `:right` keys,
 * so one side can change while the other keeps its tags. Sidewalks also convert the old
 * `sidewalk=left|right|both` schema.
 */
export function splitSides(tags: OsmTags, prefix: SidepathPrefix): OsmTags {
  const result = { ...tags }
  for (const side of ['left', 'right'] as const) {
    let value = prefix === 'sidewalk' ? sidewalkValue(tags, side) : cyclewayValue(tags, side)
    // old schema: `cycleway=opposite_track` is a contraflow track on the left
    if (value?.startsWith('opposite_')) {
      value = side === 'left' ? value.slice('opposite_'.length) : undefined
      if (result.oneway === 'yes' && result['oneway:bicycle'] === undefined)
        result['oneway:bicycle'] = 'no'
    }
    if (value !== undefined) result[`${prefix}:${side}`] = value
  }
  delete result[prefix]
  delete result[`${prefix}:both`]

  for (const [key, value] of Object.entries(tags)) {
    if (!isSidedSubKey(key, prefix) || key === `${prefix}:both`) continue
    const rest = key.slice(prefix.length + 1)
    const first = rest.split(':')[0]
    if (first === 'left' || first === 'right') continue
    const subKey = first === 'both' ? rest.slice('both:'.length) : rest // `cycleway:both:surface` / `cycleway:surface`
    for (const side of ['left', 'right']) {
      const sideKey = `${prefix}:${side}:${subKey}`
      if (result[sideKey] === undefined) result[sideKey] = value
    }
    delete result[key]
  }
  return result
}

/** Merge `prefix:left` / `prefix:right` presence values back into `prefix:both` when equal */
function mergeSides(tags: OsmTags, prefix: SidepathPrefix): OsmTags {
  const result = { ...tags }
  const left = result[`${prefix}:left`]
  if (left !== undefined && left === result[`${prefix}:right`]) {
    result[`${prefix}:both`] = left
    delete result[`${prefix}:left`]
    delete result[`${prefix}:right`]
  }
  return result
}

/**
 * The new way as a crossing, as TILDA reads one: `cycleway=crossing` on a cycleway, `path=crossing`
 * on a path (under construction the key of the `construction` value), never `track=crossing` or
 * `lane=crossing`. A crossing runs across the road, not along it: no `is_sidepath`.
 */
function asCrossingWay(tags: OsmTags): OsmTags {
  const result = { ...tags }
  for (const key of CROSSING_MARK_KEYS) if (result[key] === 'crossing') delete result[key]
  const highway = result.highway === 'construction' ? result.construction : result.highway
  if (highway) result[highway] = 'crossing'
  delete result.is_sidepath
  return result
}

/** The road side becomes `separate`; its sub-keys (and `source:`/`note:`/`check_date:` variants) go to the new way */
export function separateSide(tags: OsmTags, prefix: SidepathPrefix, side: Side): OsmTags {
  let result = splitSides(tags, prefix)
  const sidePrefix = `${prefix}:${side}`
  for (const key of Object.keys(result)) {
    const bare = key.replace(/^(source|note|check_date):/, '')
    if (bare.startsWith(`${sidePrefix}:`) || (bare === sidePrefix && key !== sidePrefix))
      delete result[key]
  }
  result[sidePrefix] = 'separate'
  result = mergeSides(result, prefix)
  return result
}

/**
 * `bicycle(:forward|:backward)=use_sidepath` on the road for a designated new way. `direction` is
 * the riding direction on the new way (`cyclewayOneway`): `yes` serves bicycles riding with the
 * road, `-1` against it. On a one-way road with only that direction, a plain `bicycle=use_sidepath`.
 */
function addUseSidepath(
  road: OsmTags,
  direction: 'yes' | '-1' | 'no',
): { tags: OsmTags; kept: string | undefined } {
  const current = road.bicycle
  if (current !== undefined && !REPLACEABLE_BICYCLE.has(current))
    return { tags: road, kept: current }
  const onlyDirection = road.oneway === 'yes' || road.oneway === '-1' ? road.oneway : undefined
  const oneWayForBikes = onlyDirection !== undefined && road['oneway:bicycle'] !== 'no'
  if (oneWayForBikes && direction === onlyDirection) {
    const tags: OsmTags = { ...road, bicycle: 'use_sidepath' }
    delete tags['bicycle:forward']
    delete tags['bicycle:backward']
    return { tags, kept: undefined }
  }
  return {
    tags: setDirectionalValue(
      road,
      'bicycle',
      direction === '-1' ? 'backward' : 'forward',
      'use_sidepath',
    ),
    kept: undefined,
  }
}

function copySideTags(target: OsmTags, side: OsmTags) {
  for (const [key, value] of Object.entries(side)) {
    if (target[key] === undefined) target[key] = value
  }
}

/** Everything the extraction changes, for one variant and side */
export type ExtractionOptions = {
  /** OsmTags a traffic sign implies; without it signs are not read */
  recommend?: SignRecommend
  /**
   * A track segregated from the sidewalk (`cycleway:<side>:segregated=yes`, variant `cycleway`):
   * `path` (default) gives a segregated foot and cycle path; `twoLines` gives the cycleway line of
   * a path mapped as two lines (`traffic_mode:<side>=foot` towards the sidewalk), for a sidewalk
   * that stays a way of its own, e.g. one that is not under construction while the road is
   */
  segregatedTrack?: 'path' | 'twoLines'
  /**
   * Extract the bike part as a crossing although the side is not marked as one (a plain lane "as a
   * crossing", `ExtractOption.crossing`). A side marked as a crossing (`isCrossingSide`) always is one.
   */
  asCrossing?: boolean
  joinSigns?: JoinSigns
  config?: Partial<SidepathConfig>
}

export function planExtraction(
  taggedRoad: OsmTags,
  variant: ExtractVariant,
  side: Side,
  options: ExtractionOptions = {},
): ExtractionPlan {
  const { recommend, joinSigns } = options
  // `cycleway:both:oneway=yes` against the traffic of a side: the new way and the side that stays
  // get the direction it most likely means
  const road = resolveSharedOneway(taggedRoad)
  const cycleway = sideTags(road, 'cycleway', side)
  const sidewalk = sideTags(road, 'sidewalk', side)
  let wayTags: OsmTags
  /** the side's sign designates it for bikes (237, 240, 241): the road gets `use_sidepath` */
  let signDesignated: boolean
  /** riding direction of the bicycles on the new way */
  let bikeOneway = cyclewayOneway(road, side, undefined)

  // a track that is segregated from the sidewalk (`cycleway:<side>:segregated=yes`): the new way is
  // a segregated foot and cycle path; the editor merges an existing sidewalk into it
  const segregated = variant === 'cycleway' && cycleway.segregated === 'yes'
  const segregatedTrack = segregated && options.segregatedTrack !== 'twoLines'

  if (variant === 'cycleway' && !segregatedTrack) {
    const sign = signTags(cycleway.traffic_sign, recommend)
    signDesignated = sign.bicycle === 'designated'
    bikeOneway = cyclewayOneway(road, side, cycleway.oneway)
    wayTags = { highway: sign.highway ?? 'cycleway', is_sidepath: 'yes' }
    for (const key of ['bicycle', 'foot', 'segregated', 'traffic_sign']) {
      if (sign[key]) wayTags[key] = sign[key]
    }
    const rest = { ...cycleway }
    delete rest.oneway
    // the cycleway line of two lines: the sidewalk is the next line outwards, on the road's side
    if (segregated) {
      delete rest.segregated
      wayTags[`traffic_mode:${side}`] = 'foot'
    }
    copySideTags(wayTags, rest)
    // the key for the direction as the oneway row asks for it: on a way with foot traffic
    // `oneway` would also apply to pedestrians (like `combinedPathTags`)
    if (onewayKey(wayTags) === 'oneway:bicycle') {
      wayTags.oneway = 'no'
      if (bikeOneway !== 'no') wayTags['oneway:bicycle'] = bikeOneway
    } else {
      wayTags.oneway = bikeOneway
    }
  } else if (variant === 'sidewalk') {
    const sign = signTags(sidewalk.traffic_sign, recommend)
    signDesignated = sign.bicycle === 'designated'
    if (sidewalk.bicycle === 'designated' || sign.highway === 'path') {
      wayTags = { highway: 'path', bicycle: 'designated', foot: 'designated', is_sidepath: 'yes' }
      for (const key of ['segregated', 'traffic_sign']) if (sign[key]) wayTags[key] = sign[key]
    } else {
      wayTags = { highway: 'footway', footway: 'sidewalk' }
      if (sign.traffic_sign) wayTags.traffic_sign = sign.traffic_sign
    }
    copySideTags(wayTags, sidewalk)
  } else {
    // the same path as merging a separate cycleway and footway (WORKDOC feature 28); a segregated
    // track alone is the bike part of it
    const foot = segregatedTrack ? {} : sidewalk
    bikeOneway = cyclewayOneway(road, side, cycleway.oneway)
    const bike: OsmTags = { ...cycleway, is_sidepath: 'yes' }
    delete bike.segregated
    bike.oneway = bikeOneway
    wayTags = combinedPathTags(bike, foot, { recommend, joinSigns }).tags
    signDesignated = [cycleway.traffic_sign, foot.traffic_sign].some(
      (value) => signTags(value, recommend).bicycle === 'designated',
    )
  }

  if (wayTags.lit === undefined && road.lit) wayTags.lit = road.lit
  // a road under construction: so is the new way (`highway=construction` + `construction=cycleway`)
  if (isUnderConstruction(road)) wayTags = withConstruction(wayTags)
  if (variant !== 'sidewalk' && (options.asCrossing || isCrossingSide(road, side)))
    wayTags = asCrossingWay(wayTags)

  // the road: the side becomes separate
  let roadTags = { ...road }
  if (variant !== 'sidewalk') roadTags = separateSide(roadTags, 'cycleway', side)
  if (variant !== 'cycleway') roadTags = separateSide(roadTags, 'sidewalk', side)

  let keptBicycle: string | undefined
  if (signDesignated) {
    const result = addUseSidepath(roadTags, bikeOneway)
    roadTags = result.tags
    keptBicycle = result.kept
  }

  return {
    wayTags,
    roadTags,
    offsetMeters: sidepathOffsetMeters(road, side, variant, options.config),
    keptBicycle,
  }
}
