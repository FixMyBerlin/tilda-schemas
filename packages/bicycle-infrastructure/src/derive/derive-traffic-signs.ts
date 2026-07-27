/** Port of topics/helper/derive_traffic_signs.lua */
import type { OsmTags } from '../types.ts'
import { sanitizeTrafficSign } from '../helpers/sanitize-traffic-sign.ts'

export interface TrafficSignResult {
  traffic_sign?: string
  'traffic_sign:forward'?: string
  'traffic_sign:backward'?: string
}

export function deriveTrafficSigns(tags: OsmTags | undefined): TrafficSignResult {
  if (tags == null) {
    return { traffic_sign: undefined, 'traffic_sign:forward': undefined, 'traffic_sign:backward': undefined }
  }
  return {
    traffic_sign: sanitizeTrafficSign(tags.traffic_sign ?? tags['traffic_sign:both']),
    'traffic_sign:forward': sanitizeTrafficSign(tags['traffic_sign:forward']),
    'traffic_sign:backward': sanitizeTrafficSign(tags['traffic_sign:backward']),
  }
}
