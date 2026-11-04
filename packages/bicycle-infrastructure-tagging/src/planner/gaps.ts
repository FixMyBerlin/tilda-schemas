import {
  writeKeyForSide,
  type BikelaneResult,
  type CategoryGap,
} from '@tilda-geo/bicycle-infrastructure'
import type { OsmTags } from '../types.ts'

/**
 * The OSM key that writes the tag of a gap of `analyzeCategoryGaps` for one result (one side of the
 * way).
 *
 * The gap keys are the keys of the transformed tags, the core's `writeKeyForSide` maps them to the
 * OSM key of a side (`is_sidepath` → `cycleway:right:is_sidepath`). That is right for all gaps
 * except the one that names the road side itself: on a road side the gap `cycleway` (`track`,
 * `lane`) is the value of `cycleway:right`, not of `cycleway:right:cycleway`.
 */
export function gapWriteKey(
  gap: Pick<CategoryGap, 'key'>,
  result: Pick<BikelaneResult, '_side' | '_prefix'>,
): string {
  const { _side: side, _prefix: prefix } = result
  if (side !== 'self' && prefix != null && gap.key === prefix) return `${prefix}:${side}`
  return writeKeyForSide(gap.key, side, prefix)
}

/** The tag that answers a gap with one of its values, ready to add to the tags of the way. */
export function gapTags(
  gap: Pick<CategoryGap, 'key'>,
  result: Pick<BikelaneResult, '_side' | '_prefix'>,
  value: string,
): OsmTags {
  return { [gapWriteKey(gap, result)]: value }
}
