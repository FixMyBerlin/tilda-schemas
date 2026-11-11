/**
 * Port of topics/roads_bikelanes/bikelanes/derive_oneway.lua and
 * topics/roads_bikelanes/bikelanes/helper/side_line_reversed.lua (tilda-geo `6ec40d600`, `bac701775`).
 *
 * OSM `oneway` values are relative to the drawing direction of the way:
 * `yes` flows with the way, `-1` against it, `no` in both directions.
 * https://wiki.openstreetmap.org/wiki/Key:oneway
 * The tags are expected after `normalizeOnewayTags` (`1`/`true` are `yes`, roundabouts `oneway=yes`).
 */
import type { BikelaneCategory, OsmTags } from '../types.ts'

export type Oneway = 'yes' | 'no' | 'car_not_bike' | 'assumed_no' | 'implicit_yes'

export interface OnewayDirection {
  oneway: Oneway
  /**
   * Whether the published line of a lane or track tagged on the road runs against the OSM way
   * (`_line_reversed` in LUA). Lines of the way itself (`_side=self`) keep the drawing direction.
   */
  lineReversed: boolean
}

const isOneway = (value: string | undefined) => value === 'yes' || value === '-1'

const ONEWAY_JUNCTIONS = new Set(['roundabout', 'circular'])

/**
 * A road whose traffic flows in one direction (is_oneway_road.lua). Also reads raw tags
 * (`1`, `true`, a roundabout without `oneway`), because editors call it before `normalizeOnewayTags`.
 */
function isOnewayRoad(road: OsmTags): boolean {
  const oneway = road.oneway
  if (oneway === 'yes' || oneway === '1' || oneway === 'true' || oneway === '-1') return true
  return oneway === undefined && road.junction !== undefined && ONEWAY_JUNCTIONS.has(road.junction)
}

/**
 * Whether bicycles ride against the drawing direction of `road` on its `left`|`right` lane when the
 * lane has no `cycleway:<side>:oneway`, the wiki default (right-hand traffic):
 * https://wiki.openstreetmap.org/wiki/Key:cycleway:right:oneway#Implicit_values
 * - One-way road: both sides follow the road, so against the way only on `oneway=-1`.
 *   `oneway:bicycle=no` changes nothing: a contraflow lane needs `cycleway:left:oneway=-1`.
 * - Other roads: the right side runs with the way, the left side against it.
 * Exported so editors suggest the same direction the processing derives.
 */
export function defaultSideRunsAgainstWay(road: OsmTags, side: 'left' | 'right'): boolean {
  if (isOnewayRoad(road)) return road.oneway === '-1'
  return side === 'left'
}

/**
 * derive_oneway.lua. Without a tag the category decides (`implicitOneWay`), also for lanes and
 * tracks tagged on the road: lanes are `implicit_yes`, tracks and shared foot and cycle paths
 * `assumed_no`. This differs from the wiki default per side on purpose (tracks outside settlements
 * are often two-way without `oneway=no`); the line direction still follows the wiki default.
 */
function onewayValue(tags: OsmTags, category: BikelaneCategory): Oneway {
  const oneway = tags.oneway
  const onewayBicycle = tags['oneway:bicycle']

  if (isOneway(onewayBicycle)) {
    return 'yes'
  } else if (onewayBicycle === 'no') {
    return isOneway(oneway) ? 'car_not_bike' : 'no'
  }

  if (isOneway(oneway)) return 'yes'
  if (oneway === 'no') return 'no'

  if (tags.highway === 'service' || tags.highway === 'track') return 'assumed_no'

  if (category.implicitOneWay) return 'implicit_yes'

  return 'assumed_no'
}

/**
 * side_line_reversed.lua. One-way lines point in the riding direction; `no` or any other value
 * keeps the side rule of two-way roads. `tags` are the transformed tags: for `_side` left|right
 * `oneway` is `cycleway:<side>:oneway`.
 */
function sideLineReversed(tags: OsmTags): boolean {
  const side = tags._side
  if (side !== 'left' && side !== 'right') return false

  const direction = tags['oneway:bicycle'] ?? tags.oneway
  if (direction === '-1') return true
  if (direction === 'yes') return false

  const parent = (tags._parent ?? {}) as OsmTags
  if (direction === undefined && isOnewayRoad(parent)) return parent.oneway === '-1'
  return side === 'left'
}

/** The TILDA `oneway` value and whether the published line runs against the OSM way. */
export function deriveOnewayDirection(tags: OsmTags, category: BikelaneCategory): OnewayDirection {
  return { oneway: onewayValue(tags, category), lineReversed: sideLineReversed(tags) }
}

/** Only the TILDA `oneway` value, see `deriveOnewayDirection`. */
export function deriveOneway(tags: OsmTags, category: BikelaneCategory): Oneway {
  return deriveOnewayDirection(tags, category).oneway
}
