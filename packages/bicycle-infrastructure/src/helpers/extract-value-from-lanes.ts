/** Port of bikelanes/helper/extract_value_from_lanes.lua */
import type { OsmTags } from '../types.ts'

// JS `split('|')` matches the LUA `gmatch('([^|]*)')` behaviour for our inputs
// (clean fields, preserved interior empties). Indices are kept 0-based throughout.
function parseLanesValue(lanesValue: string): string[] {
  return lanesValue.split('|')
}

/** Index of the `lane` (in cycleway:lanes) or `designated` (in bicycle:lanes) cell. */
export function findLaneIndex(tags: OsmTags): number | null {
  const cyclewayLanes = tags['cycleway:lanes']
  if (cyclewayLanes != null) {
    const i = parseLanesValue(cyclewayLanes).indexOf('lane')
    if (i !== -1) return i
  }
  const bicycleLanes = tags['bicycle:lanes']
  if (bicycleLanes != null) {
    const i = parseLanesValue(bicycleLanes).indexOf('designated')
    if (i !== -1) return i
  }
  return null
}

export function extractValueFromLanes(lanesTag: string, tags: OsmTags): string | undefined {
  const laneIndex = findLaneIndex(tags)
  if (laneIndex == null) return undefined
  const raw = tags[lanesTag]
  if (raw != null) {
    const values = parseLanesValue(raw)
    if (values[laneIndex] != null && values[laneIndex] !== '') return values[laneIndex]
  }
  return undefined
}

export function extractLastValueFromLanes(
  lanesValue: string | undefined | null,
): string | undefined {
  if (lanesValue == null) return undefined
  const lanes = parseLanesValue(lanesValue)
  if (lanes.length > 0) return lanes[lanes.length - 1]
  return undefined
}
