import { defaultSideRunsAgainstWay } from '@tilda-geo/bicycle-infrastructure'
import type { OsmTags, Side } from './types.ts'

/**
 * The riding direction on one side of a road, as the `oneway` value of that side, when it is not
 * tagged: with the traffic on that side. `oneway` refers to the drawing direction of the way, so
 * on the left side of a two-way road that is `-1`; on a one-way road both sides run with the road,
 * except the contraflow side (left) when bicycles may ride against the one-way.
 *
 * The direction is derived by `@tilda-geo/bicycle-infrastructure` (follows tilda-geo-private#34,
 * not merged yet); required attributes, validations and extracting a side all use it.
 */
export function sideOnewayDefault(tags: OsmTags, side: Side): 'yes' | '-1' {
  return defaultSideRunsAgainstWay(tags, side) ? '-1' : 'yes'
}
