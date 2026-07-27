/** Port of topics/roads_bikelanes/bikelanes/derive_oneway.lua */
import type { BikelaneCategory, OsmTags } from '../types.ts'

export type Oneway = 'yes' | 'no' | 'car_not_bike' | 'assumed_no' | 'implicit_yes'

export function deriveOneway(tags: OsmTags, category: BikelaneCategory): Oneway {
  if (tags['oneway:bicycle'] === 'yes') return 'yes'
  if (tags['oneway:bicycle'] === 'no') {
    return tags.oneway === 'yes' ? 'car_not_bike' : 'no'
  }

  if (tags.oneway === 'yes' || tags.oneway === 'no') return tags.oneway

  if (tags.highway === 'service' || tags.highway === 'track') return 'assumed_no'

  if (category.implicitOneWay) return 'implicit_yes'

  return 'assumed_no'
}
