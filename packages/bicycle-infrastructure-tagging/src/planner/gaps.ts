import {
  writeKeyForSide,
  type BikelaneResult,
  type CategoryGap,
} from '@tilda-geo/bicycle-infrastructure'
import type { OsmTags } from '../types.ts'

/**
 * The OSM key that writes the tag of a gap of `analyzeCategoryGaps` for one result (one side of the
 * way): `lane` → `cycleway:right:lane`, the gap `cycleway` → `cycleway:right`. Same as the core's
 * `writeKeyForSide`.
 */
export function gapWriteKey(
  gap: Pick<CategoryGap, 'key'>,
  result: Pick<BikelaneResult, '_side' | '_prefix'>,
): string {
  return writeKeyForSide(gap.key, result._side, result._prefix)
}

/** The tag that answers a gap with one of its values, ready to add to the tags of the way. */
export function gapTags(
  gap: Pick<CategoryGap, 'key'>,
  result: Pick<BikelaneResult, '_side' | '_prefix'>,
  value: string,
): OsmTags {
  return { [gapWriteKey(gap, result)]: value }
}
