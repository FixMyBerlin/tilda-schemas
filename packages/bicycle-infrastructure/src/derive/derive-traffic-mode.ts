import { removeDisallowedValue, sanitizeForLogging } from '../helpers/sanitize-for-logging.ts'
import { trafficMode } from '../sanitize/sanitize-road-tags.ts'
/** Port of topics/roads_bikelanes/bikelanes/helper/derive_traffic_mode.lua */
import type { OsmTags } from '../types.ts'

export interface TrafficModeResult {
  traffic_mode_left?: string
  traffic_mode_right?: string
}

const DIRECTIONAL_PARKING_INFERENCE_CATEGORIES = new Set([
  'cyclewayOnHighway_advisory',
  'cyclewayOnHighway_advisoryOrExclusive',
  'cyclewayOnHighway_exclusive',
  'cyclewayOnHighwayBetweenLanes',
  'cyclewayOnHighwayProtected',
])

const PARKING_ALLOWED = [
  'no',
  'yes',
  'lane',
  'street_side',
  'on_kerb',
  'half_on_kerb',
  'shoulder',
  'separate',
] as const

function sanitizeParking(value: string | undefined): string | undefined {
  if (value == null) return undefined
  return sanitizeForLogging(value, PARKING_ALLOWED)
}

function inferTrafficModeFromParking(centerlineTags: OsmTags, side: string): 'parking' | undefined {
  const raw = centerlineTags[`parking:${side}`] ?? centerlineTags['parking:both']
  const value = sanitizeParking(raw)
  if (removeDisallowedValue(value) == null) return undefined
  if (value === 'no') return undefined
  return 'parking'
}

export function deriveTrafficMode(
  bikelaneTags: OsmTags,
  centerlineTags: OsmTags,
  categoryId: string,
  side: string,
): TrafficModeResult {
  const left = removeDisallowedValue(trafficMode(bikelaneTags, 'left'))
  const right = removeDisallowedValue(trafficMode(bikelaneTags, 'right'))

  if (left != null || right != null) {
    return { traffic_mode_left: left, traffic_mode_right: right }
  }

  const inferredLeft = inferTrafficModeFromParking(centerlineTags, 'left')
  const inferredRight = inferTrafficModeFromParking(centerlineTags, 'right')

  if (categoryId === 'bicycleRoad' || categoryId === 'bicycleRoad_vehicleDestination') {
    return { traffic_mode_left: inferredLeft, traffic_mode_right: inferredRight }
  }

  if (DIRECTIONAL_PARKING_INFERENCE_CATEGORIES.has(categoryId)) {
    return {
      traffic_mode_left: undefined,
      traffic_mode_right: inferTrafficModeFromParking(centerlineTags, side),
    }
  }

  return { traffic_mode_left: left, traffic_mode_right: right }
}
