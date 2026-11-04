/** Port of topics/helper/road_width.lua */
import type { OsmTags } from '../types.ts'
import { parseWidth } from './parse-length.ts'

const STREET_WIDTHS: Record<string, number> = {
  primary: 10,
  secondary: 8,
  tertiary: 6,
  residential: 6,
}

/** Width of a road in meters: `width`, then `est_width`, then a default per `highway`, else 8. */
export function roadWidth(tags: OsmTags): number {
  const width = parseWidth(tags.width) ?? parseWidth(tags.est_width)
  if (width !== undefined) return width
  const byHighway = tags.highway === undefined ? undefined : STREET_WIDTHS[tags.highway]
  return byHighway ?? 8
}
