import { sideOnewayDefault } from '../oneway.ts'
import type { OsmTags } from '../types.ts'

/** A coordinate as `[longitude, latitude]` (GeoJSON order) */
export type LonLat = readonly [number, number]

/** A way with its tags and its coordinates in drawing order */
export interface WayGeometry {
  tags: OsmTags
  coords: readonly LonLat[]
}

/**
 * How a way of its own (a cycle path in the side space) lies next to a road: on which side of the
 * road line, and whether its line runs with the traffic on that side of the road or against it.
 */
export interface LineRelation {
  /** The side of the road line the way lies on */
  side: 'left' | 'right'
  /** The way's line runs with the traffic on that side of the road, or against it */
  line: 'with_traffic' | 'against_traffic'
}

export interface LineRelationOptions {
  /** Distance between the points that vote, along the way. Default 5 m */
  stepMeters?: number
  /** A point farther from the road does not vote. Default 25 m */
  maxDistanceMeters?: number
  /** A point closer to the road does not vote: a shared node is no side space. Default 0.5 m */
  minDistanceMeters?: number
  /** A point where way and road are less parallel than this does not vote. Default 30° */
  maxAngleDegrees?: number
  /** Fewer votes give no answer (a short piece at a junction). Default 3 */
  minVotes?: number
  /** Share of the votes that must agree. Default 0.8 */
  majority?: number
}

const DEFAULTS: Required<LineRelationOptions> = {
  stepMeters: 5,
  maxDistanceMeters: 25,
  minDistanceMeters: 0.5,
  maxAngleDegrees: 30,
  minVotes: 3,
  majority: 0.8,
}

type Point = { x: number; y: number }

const EARTH_RADIUS = 6_371_008.8

/** Meters on a plane around `origin`; precise enough at the scale of a street */
function projector(origin: LonLat) {
  const toRad = Math.PI / 180
  const cosLat = Math.cos(origin[1] * toRad)
  return ([lon, lat]: LonLat): Point => ({
    x: (lon - origin[0]) * toRad * EARTH_RADIUS * cosLat,
    y: (lat - origin[1]) * toRad * EARTH_RADIUS,
  })
}

/** Points every `step` meters along the line, each with the direction of its segment */
function samples(line: readonly Point[], step: number) {
  const result: { point: Point; dx: number; dy: number }[] = []
  let next = step / 2
  let walked = 0
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!
    const b = line[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length === 0) continue
    while (next <= walked + length) {
      const t = (next - walked) / length
      result.push({ point: { x: a.x + dx * t, y: a.y + dy * t }, dx: dx / length, dy: dy / length })
      next += step
    }
    walked += length
  }
  return result
}

/** The nearest point of the line to `p`, with the direction of that segment */
function nearest(line: readonly Point[], p: Point) {
  let best: { distance: number; q: Point; dx: number; dy: number } | undefined
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!
    const b = line[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length2 = dx * dx + dy * dy
    if (length2 === 0) continue
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2))
    const q = { x: a.x + dx * t, y: a.y + dy * t }
    const distance = Math.hypot(p.x - q.x, p.y - q.y)
    if (!best || distance < best.distance) {
      const length = Math.sqrt(length2)
      best = { distance, q, dx: dx / length, dy: dy / length }
    }
  }
  return best
}

type Vote = { side: 'left' | 'right'; along: boolean; distance: number }

/** Each sample point of the way that lies parallel next to the road votes for a side and a direction */
function votes(
  way: readonly LonLat[],
  road: readonly LonLat[],
  options: Required<LineRelationOptions>,
) {
  if (way.length < 2 || road.length < 2) return []
  const project = projector(way[0]!)
  const roadLine = road.map(project)
  const minCos = Math.cos((options.maxAngleDegrees * Math.PI) / 180)
  const result: Vote[] = []
  for (const sample of samples(way.map(project), options.stepMeters)) {
    const hit = nearest(roadLine, sample.point)
    if (!hit) continue
    if (hit.distance > options.maxDistanceMeters || hit.distance < options.minDistanceMeters)
      continue
    const cos = sample.dx * hit.dx + sample.dy * hit.dy
    if (Math.abs(cos) < minCos) continue
    // the cross product of the road direction and the offset: positive is left of the road line
    const cross = hit.dx * (sample.point.y - hit.q.y) - hit.dy * (sample.point.x - hit.q.x)
    result.push({ side: cross > 0 ? 'left' : 'right', along: cos > 0, distance: hit.distance })
  }
  return result
}

/** The side the way lies on, when enough points agree, with their mean distance */
function sideOf(list: readonly Vote[], options: Required<LineRelationOptions>) {
  if (list.length < options.minVotes) return undefined
  const left = list.filter((vote) => vote.side === 'left')
  const winners = left.length * 2 >= list.length ? left : list.filter((v) => v.side === 'right')
  if (winners.length < list.length * options.majority) return undefined
  const distance = winners.reduce((sum, vote) => sum + vote.distance, 0) / winners.length
  return { side: winners[0]!.side, votes: winners, distance }
}

/**
 * How the line of a way of its own runs next to a road: on which side of the road line it lies, and
 * whether it runs with the traffic on that side (`sideOnewayDefault` of the road) or against it.
 *
 * The way votes with a point every 5 m that lies 0.5–25 m from the road and runs parallel to it
 * (less than 30°). `undefined` when fewer than 3 points vote or fewer than 80 % agree (a short piece
 * at a junction, a way that leaves the road), and where the traffic on that side gives no direction:
 * on a roundabout, and on the left of a one-way road (the median of a dual carriageway, or a path
 * that runs against the one-way on purpose).
 *
 * Which road to pass: see `pickSidepathRoad`; the nearest road is often the wrong one.
 */
export function lineRelationToRoad(
  way: readonly LonLat[],
  road: WayGeometry,
  options: LineRelationOptions = {},
): LineRelation | undefined {
  const settings = { ...DEFAULTS, ...options }
  if (road.tags.junction === 'roundabout' || road.tags.junction === 'circular') return undefined
  const found = sideOf(votes(way, road.coords, settings), settings)
  if (!found) return undefined
  const along = found.votes.filter((vote) => vote.along).length
  const runsAlong = along * 2 >= found.votes.length
  if ((runsAlong ? along : found.votes.length - along) < found.votes.length * settings.majority) {
    return undefined
  }
  const expected = sideOnewayDefault(road.tags, found.side)
  const other = sideOnewayDefault(road.tags, found.side === 'left' ? 'right' : 'left')
  // one-way road: both sides run the same way; its left side (in the direction of travel) gives none
  if (expected === other) {
    const leftOfTraffic = expected === 'yes' ? 'left' : 'right'
    if (found.side === leftOfTraffic) return undefined
  }
  return {
    side: found.side,
    line: runsAlong === (expected === 'yes') ? 'with_traffic' : 'against_traffic',
  }
}

/** The road tags that say that the side `side` is mapped as a way of its own */
function separateRank(tags: OsmTags, side: 'left' | 'right') {
  const separate = (prefix: string) =>
    [`${prefix}:${side}`, `${prefix}:both`, prefix].some((key) => tags[key] === 'separate')
  if (separate('cycleway')) return 0
  if (separate('sidewalk')) return 1
  return 2
}

/**
 * The road a way of its own belongs to, out of the roads near it (the editor finds them, e.g. all
 * roads within 25 m). The nearest road is often the wrong one: a service road between the path and
 * the carriageway, or a parallel one-way street. So first a road that maps this side as separate
 * (`cycleway:<side>=separate`, `cycleway:both=separate`, `cycleway=separate`), then one with
 * `sidewalk:<side>|both=separate` or `sidewalk=separate`, then the nearest. `<side>` is the side of
 * that road the way lies on. Only roads the way runs parallel to count (see `lineRelationToRoad`).
 */
export function pickSidepathRoad<Road extends WayGeometry>(
  way: readonly LonLat[],
  roads: readonly Road[],
  options: LineRelationOptions = {},
): Road | undefined {
  const settings = { ...DEFAULTS, ...options }
  let best: { road: Road; rank: number; distance: number } | undefined
  for (const road of roads) {
    const found = sideOf(votes(way, road.coords, settings), settings)
    if (!found) continue
    const rank = separateRank(road.tags, found.side)
    if (!best || rank < best.rank || (rank === best.rank && found.distance < best.distance)) {
      best = { road, rank, distance: found.distance }
    }
  }
  return best?.road
}
