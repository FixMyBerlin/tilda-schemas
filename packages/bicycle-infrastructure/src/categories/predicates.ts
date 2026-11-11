import { extractLastValueFromLanes } from '../helpers/extract-value-from-lanes.ts'
import { sanitizeTrafficSign } from '../helpers/sanitize-traffic-sign.ts'
import { containsSubstring, hasPrefix, hasSuffix, hasTagWithPrefix } from '../helpers/strings.ts'
import { PROTECTIVE_SEPARATION } from '../sanitize/sanitize-road-tags.ts'
/** Shared imperative predicates used by category macros (ported from bikelane_categories.lua). */
import type { OsmTags } from '../types.ts'
import { categoryIsSidepath } from './category-is-sidepath.ts'

export function hasBetweenLanesConditions(tags: OsmTags): boolean {
  if (tags._side === 'left' || tags._side === 'right') {
    if (containsSubstring(tags['cycleway:lanes'], '|lane|')) return true
    if (containsSubstring(tags['bicycle:lanes'], '|designated|')) return true
    if (containsSubstring(tags.lanes, '|lane|')) return true
    if (tags._parent && containsSubstring(tags._parent['bicycle:lanes'], '|designated|'))
      return true
  }
  return false
}

export function isCrossingPattern(tags: OsmTags): boolean {
  if (tags.highway === 'cycleway' && tags.cycleway === 'lane' && tags.lane === 'crossing')
    return true
  if (
    tags.highway === 'cycleway' &&
    (tags.cycleway === 'crossing' || tags.cycleway === 'traffic_island')
  )
    return true
  if (
    tags.highway === 'path' &&
    (tags.path === 'crossing' || tags.path === 'traffic_island') &&
    (tags.bicycle === 'yes' || tags.bicycle === 'designated')
  )
    return true
  if (
    tags.highway === 'footway' &&
    (tags.footway === 'crossing' || tags.footway === 'traffic_island') &&
    (tags.bicycle === 'yes' || tags.bicycle === 'designated')
  )
    return true
  return false
}

export function bicycleRoadBase(tags: OsmTags): boolean | undefined {
  if (tags.bicycle_road === 'yes') return true
  const trafficSign = sanitizeTrafficSign(tags.traffic_sign)
  if (hasPrefix(trafficSign, 'DE:244')) return true
  return undefined
}

export function bicycleRoadVehicleDestination(tags: OsmTags): boolean | undefined {
  if (!bicycleRoadBase(tags)) return undefined
  const trafficSign = sanitizeTrafficSign(tags.traffic_sign)
  if (containsSubstring(trafficSign, '1020-30')) return true
  if (
    containsSubstring(trafficSign, 'Kraftfahrzeuge-frei') ||
    containsSubstring(trafficSign, 'Kfz-Verkehr frei') ||
    containsSubstring(trafficSign, 'KFZ frei')
  )
    return true
  if (
    tags.vehicle === 'destination' ||
    tags.motor_vehicle === 'destination' ||
    tags.vehicle === 'yes' ||
    tags.motor_vehicle === 'yes'
  )
    return true
  return undefined
}

/**
 * Unsigned cycleway ('anderer Radweg', tilda-geo 98e649800): `highway=cycleway` with an explicit
 * `traffic_sign=none`. Shared and segregated foot paths match their own categories first.
 * `highway=cycleway` without any `traffic_sign` stays `needsClarification`.
 */
export function unsignedCycleway(tags: OsmTags): boolean | undefined {
  if (
    tags.highway === 'cycleway' &&
    sanitizeTrafficSign(tags.traffic_sign) === 'none' &&
    // the side object of a lane between the car lanes (tilda-geo 34fb8457d)
    !hasBetweenLanesConditions(tags)
  )
    return true
  return undefined
}

export function footwayBicycleYes(tags: OsmTags): boolean | undefined {
  if (isCrossingPattern(tags)) return false
  if (tags.highway !== 'footway' && tags.highway !== 'path') return undefined

  const hasBicycleAccess =
    tags.bicycle === 'yes' || containsSubstring(sanitizeTrafficSign(tags.traffic_sign), '1022-10')
  if (!hasBicycleAccess) return undefined

  if (tags['mtb:scale'] != null) {
    const cleaned = tags['mtb:scale'].replace(/[+\-\s]/g, '')
    const numeric = cleaned === '' ? NaN : Number(cleaned)
    if (Number.isNaN(numeric)) return undefined
    if (numeric > 1) return undefined
    if (tags.traffic_sign == null && tags.is_sidepath == null) return undefined
  }
  return true
}

export function crossing(tags: OsmTags): boolean | undefined {
  if (tags._length != null && tags._length > 100) return false
  return isCrossingPattern(tags) || undefined
}

/**
 * `not_expected`: on a oneway road the side against the flow has no infrastructure by default.
 * `oneway=-1` flows against the way, so there it is the right side (tilda-geo `bac701775`).
 */
export function implicitOneWay(tags: OsmTags): boolean | undefined {
  let result = tags._prefix === 'cycleway' && tags._infix === ''
  result = result && tags._parent?.['oneway:bicycle'] !== 'no'
  result =
    result &&
    ((tags._parent?.oneway === 'yes' && tags._side === 'left') ||
      (tags._parent?.oneway === '-1' && tags._side === 'right'))
  return result || undefined
}

/** Side-effect: may set tags.width from parent width:lanes when between-lanes. */
export function cyclewayOnHighwayAdvisoryOrExclusiveBase(tags: OsmTags): boolean | undefined {
  if (tags.highway === 'cycleway') {
    if (hasBetweenLanesConditions(tags)) {
      if (containsSubstring(tags.lanes, '|lane|') && !hasSuffix(tags.lanes, '|lane')) return false
      if (
        tags._parent != null &&
        containsSubstring(tags._parent['bicycle:lanes'], '|designated|') &&
        !hasSuffix(tags._parent['bicycle:lanes'], '|designated')
      )
        return false
      const sourceWidth = tags._parent
        ? extractLastValueFromLanes(tags._parent['width:lanes'])
        : undefined
      tags.width = tags.width ?? sourceWidth
    }
    if (tags.cycleway === 'lane' || tags.cycleway === 'opposite_lane') return true
  }
  return undefined
}

export function cyclewayOnHighwayBetweenLanes(tags: OsmTags): boolean | undefined {
  if (tags._side === 'self') {
    if (containsSubstring(tags['cycleway:lanes'], '|lane|')) return true
    if (containsSubstring(tags['bicycle:lanes'], '|designated|')) return true
  }
  return undefined
}

export function cyclewayOnHighwayProtected(tags: OsmTags): boolean | undefined {
  if (isCrossingPattern(tags)) return false
  if (!categoryIsSidepath(tags)) return false
  if (tags.lane === 'advisory') return false
  if (tags.cycleway === 'share_busway' || tags.cycleway === 'opposite_share_busway') return false

  const allowedSeparation = new Set<string>(PROTECTIVE_SEPARATION)

  const trafficModeRight = tags.traffic_mode_right
  const separationLeft = tags.separation_left
  if (separationLeft != null && allowedSeparation.has(separationLeft)) {
    if (trafficModeRight === 'motor_vehicle') return false
    if (tags.segregated != null) return false
    return true
  }

  const trafficModeLeft = tags.traffic_mode_left
  if (trafficModeLeft === 'parking') {
    if (tags.segregated != null) return false
    return true
  }

  const separationRight = tags.separation_right
  if (
    trafficModeRight === 'motor_vehicle' &&
    separationRight != null &&
    allowedSeparation.has(separationRight)
  ) {
    return true
  }
  return undefined
}

export function sharedBusLaneBusWithBike(tags: OsmTags): boolean | undefined {
  if (isCrossingPattern(tags)) return false
  if (tags.highway !== 'cycleway') return undefined
  const trafficSign = sanitizeTrafficSign(tags.traffic_sign)
  const parentTrafficSign = tags._parent
    ? sanitizeTrafficSign(tags._parent.traffic_sign)
    : undefined
  if (
    tags.cycleway === 'share_busway' ||
    tags.cycleway === 'opposite_share_busway' ||
    (hasPrefix(trafficSign, 'DE:245') &&
      (containsSubstring(trafficSign, '1022-10') || containsSubstring(trafficSign, '1022-14'))) ||
    (hasPrefix(parentTrafficSign, 'DE:245') &&
      (containsSubstring(parentTrafficSign, '1022-10') ||
        containsSubstring(parentTrafficSign, '1022-14')))
  )
    return true
  return undefined
}

export function sharedBusLaneBikeWithBus(tags: OsmTags): boolean | undefined {
  if (isCrossingPattern(tags)) return false
  if (tags.highway !== 'cycleway') return undefined
  const trafficSign = sanitizeTrafficSign(tags.traffic_sign)
  const parentTrafficSign = tags._parent
    ? sanitizeTrafficSign(tags._parent.traffic_sign)
    : undefined
  if (
    tags.lane === 'share_busway' ||
    (hasPrefix(trafficSign, 'DE:237') &&
      (containsSubstring(trafficSign, '1024-14') || containsSubstring(trafficSign, '1026-32'))) ||
    (hasPrefix(parentTrafficSign, 'DE:237') &&
      (containsSubstring(parentTrafficSign, '1024-14') ||
        containsSubstring(parentTrafficSign, '1026-32')))
  )
    return true
  return undefined
}

export function needsClarification(tags: OsmTags): boolean | undefined {
  if (hasBetweenLanesConditions(tags)) return false
  if (tags.cycleway === 'shared') return false
  if (tags.highway === 'cycleway') return true
  if (tags.highway === 'path' && tags.bicycle === 'designated') {
    if (tags.foot === 'no') {
      const excludedSurfaces = new Set([
        'ground',
        'dirt',
        'fine_gravel',
        'gravel',
        'pebblestone',
        'earth',
      ])
      if (
        hasTagWithPrefix(tags, 'mtb:') ||
        tags.mtb === 'yes' ||
        (tags.surface != null && excludedSurfaces.has(tags.surface))
      ) {
        return false
      }
      return true
    }
    return true
  }
  if (tags.highway === 'footway' && tags.bicycle === 'designated') return true
  return undefined
}
