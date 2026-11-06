/**
 * Start cases for the round trip of every mapping target: plan → apply → `processBikelanes`.
 * Generated as a matrix; combinations the planner cannot reach are listed in
 * `EXPECTED_UNREACHABLE` with a reason, never skipped silently.
 */
import type { MappingTarget, OsmTags, PlanConflictCode, ResultSide } from '../src/index.ts'

export interface StartCase {
  name: string
  tags: OsmTags
  side: ResultSide
  /** the key of `traffic_sign` for this side */
  signKey: string
}

const SIGNS = [undefined, 'none', 'DE:240', 'DE:241'] as const
const SEGREGATED = [undefined, 'yes', 'no'] as const
const IS_SIDEPATH = [undefined, 'yes', 'no'] as const

/** Ways of their own (`self`) */
export const SELF_HIGHWAYS = ['path', 'footway', 'cycleway', 'pedestrian', 'residential'] as const
/** `cycleway:right` on a road (`right`) */
export const ROAD_SIDE_PRESENCE = [undefined, 'track', 'lane', 'no'] as const

function describe(tags: OsmTags) {
  return Object.entries(tags)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
}

function withOptional(tags: OsmTags, key: string, value: string | undefined): OsmTags {
  return value === undefined ? tags : { ...tags, [key]: value }
}

export function startCases(): StartCase[] {
  const cases: StartCase[] = []
  for (const highway of SELF_HIGHWAYS) {
    for (const sign of SIGNS) {
      for (const segregated of SEGREGATED) {
        for (const isSidepath of IS_SIDEPATH) {
          let tags: OsmTags = { highway }
          tags = withOptional(tags, 'traffic_sign', sign)
          tags = withOptional(tags, 'segregated', segregated)
          tags = withOptional(tags, 'is_sidepath', isSidepath)
          cases.push({ name: describe(tags), tags, side: 'self', signKey: 'traffic_sign' })
        }
      }
    }
  }
  for (const presence of ROAD_SIDE_PRESENCE) {
    for (const sign of SIGNS) {
      for (const segregated of SEGREGATED) {
        let tags: OsmTags = { highway: 'secondary' }
        tags = withOptional(tags, 'cycleway:right', presence)
        tags = withOptional(tags, 'cycleway:right:traffic_sign', sign)
        tags = withOptional(tags, 'cycleway:right:segregated', segregated)
        cases.push({
          name: `${describe(tags)} (right)`,
          tags,
          side: 'right',
          signKey: 'cycleway:right:traffic_sign',
        })
      }
    }
  }
  // the side shares its tags with the other side, or is on the left, or the road has a sidewalk
  const roads: { tags: OsmTags; side: ResultSide }[] = [
    { tags: { highway: 'secondary', 'cycleway:both': 'lane' }, side: 'right' },
    { tags: { highway: 'secondary', 'cycleway:both': 'track' }, side: 'right' },
    { tags: { highway: 'secondary', cycleway: 'lane' }, side: 'left' },
    { tags: { highway: 'secondary', 'cycleway:left': 'track' }, side: 'left' },
    { tags: { highway: 'secondary', 'sidewalk:both': 'yes' }, side: 'right' },
    { tags: { highway: 'secondary', 'sidewalk:right': 'separate' }, side: 'right' },
  ]
  for (const { tags, side } of roads) {
    cases.push({
      name: `${describe(tags)} (${side})`,
      tags,
      side,
      signKey: `cycleway:${side}:traffic_sign`,
    })
  }
  return cases
}

/**
 * Combinations the planner cannot reach, with the reason. The first rule that applies counts.
 * Every rule must apply to at least one case (no stale rules).
 */
export interface UnreachableRule {
  reason: string
  code?: PlanConflictCode
  applies: (target: MappingTarget, start: StartCase) => boolean
}

const OWN_WAYS = new Set(['path', 'footway', 'cycleway', 'pedestrian'])
const isOwnWay = (c: StartCase) => c.side === 'self' && OWN_WAYS.has(c.tags.highway!)
const isRoadCenterline = (c: StartCase) => c.side === 'self' && c.tags.highway === 'residential'
const isRoadSide = (c: StartCase) => c.side !== 'self'
const PATH = /^(cycleway|footAndCycleway(Shared|Segregated)|footwayBicycleYes)_/
const LANE = /^(cyclewayOnHighway|sharedMotorVehicleLane)/

export const EXPECTED_UNREACHABLE: UnreachableRule[] = [
  {
    reason:
      'A lane needs a road: a path, footway, cycleway or pedestrian area has no lanes (a protected lane can be a highway=cycleway of its own)',
    code: 'geometry_lane_needs_road',
    applies: (t, c) =>
      LANE.test(t.categoryId) &&
      isOwnWay(c) &&
      !(t.categoryId === 'cyclewayOnHighwayProtected' && c.tags.highway === 'cycleway'),
  },
  {
    reason: 'A bus lane needs a road or a highway=cycleway of its own',
    code: 'geometry_bus_lane_needs_road',
    applies: (t, c) =>
      t.categoryId.startsWith('sharedBusLane') && isOwnWay(c) && c.tags.highway !== 'cycleway',
  },
  {
    reason: 'A pedestrian zone with bicycles allowed needs highway=pedestrian',
    code: 'geometry_pedestrian_area_needs_pedestrian',
    applies: (t, c) =>
      t.categoryId === 'pedestrianAreaBicycleYes' && c.tags.highway !== 'pedestrian',
  },
  {
    reason: 'A path on the centerline of a road: plan it for a road side (or a way of its own)',
    code: 'geometry_path_needs_road_side',
    applies: (t, c) => PATH.test(t.categoryId) && isRoadCenterline(c),
  },
  {
    reason: 'A lane on the centerline of a road: plan it for a road side',
    code: 'geometry_lane_needs_road_side',
    applies: (t, c) =>
      (LANE.test(t.categoryId) || t.categoryId.startsWith('sharedBusLane')) &&
      t.categoryId !== 'cyclewayOnHighwayBetweenLanes' &&
      isRoadCenterline(c),
  },
  {
    reason:
      'Between lanes needs the lane layout of the road (cycleway:lanes / bicycle:lanes); the planner does not guess it',
    applies: (t, c) => t.categoryId === 'cyclewayOnHighwayBetweenLanes' && isRoadCenterline(c),
  },
  {
    reason:
      'Bicycle road, between lanes, link and crossing are the road itself or a way of its own',
    code: 'geometry_not_a_road_side',
    applies: (t, c) =>
      /^(bicycleRoad|cyclewayOnHighwayBetweenLanes$|cyclewayLink$|crossing$)/.test(t.categoryId) &&
      isRoadSide(c),
  },
  {
    reason: 'Two lines (cycleway + footway of their own) need a way of their own',
    code: 'geometry_needs_separate_way',
    applies: (t, c) => t.separateWayOnly && isRoadSide(c),
  },
  {
    reason: 'A road side always runs along the road: it cannot be *_isolated',
    code: 'geometry_isolated_not_a_road_side',
    applies: (t, c) => t.categoryId.endsWith('_isolated') && isRoadSide(c),
  },
  {
    reason:
      'A protected lane must not carry segregated (LUA); the planner adds and changes tags, it does not remove them',
    applies: (t, c) =>
      t.categoryId === 'cyclewayOnHighwayProtected' &&
      (isRoadSide(c)
        ? c.tags['cycleway:right:segregated'] !== undefined
        : c.tags.segregated !== undefined),
  },
  {
    reason:
      'A foot and cycle path sign (DE:240 / DE:241) on the side makes it a foot and cycle path; the planner does not remove an observed sign for a lane',
    applies: (t, c) =>
      /^cyclewayOnHighway_(advisory|exclusive)$/.test(t.categoryId) &&
      isRoadSide(c) &&
      /DE:24[01]/.test(c.tags['cycleway:right:traffic_sign'] ?? ''),
  },
]
