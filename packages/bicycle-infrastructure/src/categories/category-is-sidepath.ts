/** Port of bikelanes/categories/category_is_sidepath.lua */
import type { OsmTags } from '../types.ts'

export function categoryIsSidepath(tags: OsmTags): boolean {
  return (
    tags.is_sidepath === 'yes' ||
    Boolean(tags._parent_highway) || // split off a centerline => treated as sidepath
    tags.footway === 'sidewalk' ||
    tags.path === 'sidewalk' ||
    tags.path === 'sidepath' ||
    tags.cycleway === 'sidepath' ||
    tags.steps === 'sidewalk'
  )
}
