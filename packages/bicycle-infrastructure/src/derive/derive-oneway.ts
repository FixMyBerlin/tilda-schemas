/**
 * Port of topics/roads_bikelanes/bikelanes/derive_oneway.lua as in the tilda-geo branch
 * `claude/tilda-oneway-processing-81b448` (follows tilda-geo-private#34, not merged yet).
 * It replaces the `develop` version, which has no `-1`, no line direction and no side defaults.
 *
 * OSM `oneway` values are relative to the drawing direction of the way:
 * `yes` (or `1`) flows with the way, `-1` against it, `no` in both directions.
 * https://wiki.openstreetmap.org/wiki/Key:oneway
 */
import type { BikelaneCategory, OsmTags } from '../types.ts'

export type Oneway = 'yes' | 'no' | 'car_not_bike' | 'assumed_no' | 'implicit_yes'

export interface OnewayDirection {
  oneway: Oneway
  /**
   * Whether the published line runs against the OSM way (`_line_reversed` in LUA).
   * One-way lines point in the riding direction, `car_not_bike` lines in the motor direction.
   * Two-way lines keep the side convention: left runs against the way, right and self with it.
   */
  lineReversed: boolean
}

const WITH_WAY = new Set(['yes', '1'])
const AGAINST_WAY = new Set(['-1'])

const isWithWay = (value: string | undefined) => value != null && WITH_WAY.has(value)
const isAgainstWay = (value: string | undefined) => value != null && AGAINST_WAY.has(value)

/**
 * Direction of a left|right lane that has no `cycleway:<side>:oneway` (right-hand traffic).
 * https://wiki.openstreetmap.org/wiki/Key:cycleway:right:oneway#Implicit_values
 * - Two-way road: right flows with the way, left against it.
 * - Parent `oneway=yes`: both sides flow with the way.
 * - Parent `oneway=yes` + `oneway:bicycle=no`: the left lane is the contraflow lane. The German
 *   mapping guide tags it without `cycleway:left:oneway=-1`:
 *   https://wiki.openstreetmap.org/wiki/DE:Bicycle/Radverkehrsanlagen_kartieren#Einbahnstraße_mit_Erlaubnis_für_Radfahrende_in_Gegenrichtung
 * - Parent `oneway=-1`: not documented; we mirror the `oneway=yes` rules.
 */
function sideDefaultAgainstWay(tags: OsmTags): boolean {
  const parent: OsmTags = tags._parent ?? {}
  const contraflowAllowed = parent['oneway:bicycle'] === 'no'
  if (isWithWay(parent.oneway)) {
    return contraflowAllowed && tags._side === 'left'
  }
  if (isAgainstWay(parent.oneway)) {
    return !(contraflowAllowed && tags._side === 'right')
  }
  return tags._side === 'left'
}

function onewayValue(tags: OsmTags, category: BikelaneCategory): Oneway {
  const oneway = tags.oneway
  const onewayBicycle = tags['oneway:bicycle']
  const isSide = tags._side === 'left' || tags._side === 'right'

  if (isWithWay(onewayBicycle) || isAgainstWay(onewayBicycle)) {
    return 'yes'
  } else if (onewayBicycle === 'no') {
    return isWithWay(oneway) || isAgainstWay(oneway) ? 'car_not_bike' : 'no'
  }

  if (isWithWay(oneway) || isAgainstWay(oneway)) return 'yes'
  if (oneway === 'no') return 'no'

  // The wiki default for lanes and tracks tagged on the road is one direction per side;
  // two-way needs an explicit `cycleway:<side>:oneway=no`.
  if (isSide) return 'implicit_yes'

  if (tags.highway === 'service' || tags.highway === 'track') return 'assumed_no'

  if (category.implicitOneWay) return 'implicit_yes'

  return 'assumed_no'
}

/**
 * The TILDA `oneway` value and whether the published line runs against the OSM way.
 * `tags` are the transformed tags: for `_side` left|right `oneway` is `cycleway:<side>:oneway`.
 */
export function deriveOnewayDirection(tags: OsmTags, category: BikelaneCategory): OnewayDirection {
  const oneway = onewayValue(tags, category)

  if (tags._side !== 'left' && tags._side !== 'right') {
    // `oneway:bicycle=yes` on a `oneway=-1` road follows the road direction.
    return {
      oneway,
      lineReversed: isAgainstWay(tags.oneway) || isAgainstWay(tags['oneway:bicycle']),
    }
  }

  if (oneway !== 'yes' && oneway !== 'implicit_yes') {
    return { oneway, lineReversed: tags._side === 'left' }
  }

  if (isAgainstWay(tags['oneway:bicycle']) || isAgainstWay(tags.oneway)) {
    return { oneway, lineReversed: true }
  } else if (isWithWay(tags.oneway)) {
    return { oneway, lineReversed: false }
  }
  return { oneway, lineReversed: sideDefaultAgainstWay(tags) }
}

/** Only the TILDA `oneway` value, see `deriveOnewayDirection`. */
export function deriveOneway(tags: OsmTags, category: BikelaneCategory): Oneway {
  return deriveOnewayDirection(tags, category).oneway
}
