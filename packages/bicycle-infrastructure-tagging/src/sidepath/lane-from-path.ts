import { pathRole } from '../path-role.ts'
import type { OsmTags } from '../types.ts'
import type { MessageRef } from '../validations/types.ts'
import { cyclewayOneway, separateSide, type Side } from './extract-tags.ts'

/**
 * "Extract the bike lane from a segregated foot and cycle path": a way mapped as a segregated path
 * (`highway=path` + `segregated=yes`, or `highway=cycleway` + `foot=designated` + `segregated=yes`)
 * that is really a sidewalk next to a bike lane on the carriageway. The way stays and becomes the
 * sidewalk; the lane becomes a line of its own (`line`) or is tagged on the road (`centerline`).
 */

export type LaneFromPathTarget = 'line' | 'centerline'

export interface LaneFromPathOptions {
  /** The side of the road line the path lies on (`wayPlacement` / `pickSidepathRoad`) */
  roadSide: Side
  /** The path is drawn in the direction of the road line (`wayPlacement(...).along`) */
  pathAlongRoad: boolean
  /** `line`: the lane as a way of its own; `centerline`: tagged on the road */
  target: LaneFromPathTarget
  /**
   * `exclusive` (default): a Radfahrstreifen, solid line; `advisory`: a Schutzstreifen, dashed
   * line. TILDA needs one of them for the category.
   */
  lane?: 'exclusive' | 'advisory'
}

export interface LaneFromPathPlan {
  /** The tags of the path, which stays and becomes the sidewalk */
  footwayTags: OsmTags
  /**
   * `line`: the tags of the new lane. Draw it in the direction of the road line, next to the road
   * line on `roadSide` (on the carriageway, between the road line and the sidewalk); `oneway` is
   * relative to that drawing direction, as in `planExtraction`.
   */
  laneTags?: OsmTags
  /** The road with the lane (`centerline`) or `cycleway:<side>=separate` (`line`) */
  roadTags: OsmTags
  /** What the mapper should look at; nothing was guessed for these (`renderMessage`) */
  review: MessageRef[]
}

const CROSSING_VALUES = new Set(['crossing', 'traffic_island'])

/**
 * The extraction fits this way: a segregated foot and cycle path as one line, not a crossing.
 * The editor also needs the road (`pickSidepathRoad`) and the side (`wayPlacement`).
 */
export function canPlanLaneFromSegregatedPath(tags: OsmTags): boolean {
  if (['path', 'cycleway', 'footway'].some((key) => CROSSING_VALUES.has(tags[key] ?? '')))
    return false
  if (tags.area === 'yes') return false
  const role = pathRole(tags)
  return role.style === 'oneLine' && role.segregated === true
}

/** Keys of the bike part that go away with it */
const BIKE_KEY = /^(bicycle|segregated|oneway:bicycle|traffic_mode(:.*)?|cycleway(:.*)?)$/
/** Values of `bicycle` on the road that send bikes to a way of their own */
const USE_SIDEPATH = 'use_sidepath'

/** The riding direction of the lane, relative to the road line */
function laneOneway(path: OsmTags, road: OsmTags, options: LaneFromPathOptions) {
  // TILDA reads `oneway:bicycle` on a path with foot traffic; a plain `oneway` there is often meant
  const value = path['oneway:bicycle'] ?? path.oneway
  if (value === 'no') return 'no'
  if (value === 'yes' || value === '-1') {
    const alongPath = value === 'yes'
    return alongPath === options.pathAlongRoad ? 'yes' : '-1'
  }
  // untagged: with the traffic on that side of the road
  return cyclewayOneway(road, options.roadSide, undefined)
}

/** `cycleway:<sub>` of the path, as `<sub>` (`cycleway:width` → `width`) */
function bikePart(path: OsmTags): OsmTags {
  const result: OsmTags = {}
  for (const [key, value] of Object.entries(path)) {
    if (key.startsWith('cycleway:')) result[key.slice('cycleway:'.length)] = value
  }
  return result
}

function footwayOf(path: OsmTags, review: MessageRef[]): OsmTags {
  const result: OsmTags = {}
  for (const [key, value] of Object.entries(path)) {
    if (BIKE_KEY.test(key) || key === 'oneway' || key.startsWith('footway:')) continue
    result[key] = value
  }
  result.highway = 'footway'
  result.footway = 'sidewalk'
  result.is_sidepath = 'yes'
  for (const [key, value] of Object.entries(path)) {
    if (key.startsWith('footway:')) result[key.slice('footway:'.length)] = value
  }
  // the width of the whole path is not the width of the sidewalk
  if (path.width !== undefined && path['footway:width'] === undefined) {
    delete result.width
    review.push({ code: 'lane_from_path.footway_width', params: { width: path.width } })
  }
  if (path.traffic_sign !== undefined) {
    review.push({ code: 'lane_from_path.traffic_sign', params: { sign: path.traffic_sign } })
  }
  return result
}

/**
 * The tags for "extract the bike lane from a segregated foot and cycle path"
 * (`canPlanLaneFromSegregatedPath`). The path becomes `highway=footway` + `footway=sidewalk`; its
 * bike part (`cycleway:width`, `cycleway:surface`, the direction) goes to the lane.
 *
 * Nothing is guessed for the traffic sign (a 241 no longer fits the sidewalk), the width of the
 * sidewalk when only the whole path has one, and `bicycle=use_sidepath` on the road: they are in
 * `review`.
 */
export function planLaneFromSegregatedPath(
  pathTags: OsmTags,
  roadTags: OsmTags,
  options: LaneFromPathOptions,
): LaneFromPathPlan {
  const { roadSide: side, target } = options
  const lane = options.lane ?? 'exclusive'
  const review: MessageRef[] = []
  const footwayTags = footwayOf(pathTags, review)
  const bike = bikePart(pathTags)
  const oneway = laneOneway(pathTags, roadTags, options)

  // the sidewalk stays a way of its own; the old separate cycleway side is cleared
  const road = separateSide(separateSide(roadTags, 'sidewalk', side), 'cycleway', side)
  let laneTags: OsmTags | undefined

  if (target === 'line') {
    laneTags = { highway: 'cycleway', cycleway: 'lane', lane, ...bike, oneway }
  } else {
    const prefix = `cycleway:${side}`
    road[prefix] = 'lane'
    road[`${prefix}:lane`] = lane
    for (const [key, value] of Object.entries(bike)) road[`${prefix}:${key}`] = value
    if (oneway !== cyclewayOneway(roadTags, side, undefined)) road[`${prefix}:oneway`] = oneway
    else delete road[`${prefix}:oneway`]
  }

  const useSidepath = ['bicycle', 'bicycle:forward', 'bicycle:backward'].filter(
    (key) => roadTags[key] === USE_SIDEPATH,
  )
  if (useSidepath.length) {
    review.push({
      code: 'lane_from_path.road_use_sidepath',
      params: { keys: useSidepath.join(', ') },
    })
  }

  return { footwayTags, ...(laneTags ? { laneTags } : {}), roadTags: road, review }
}
