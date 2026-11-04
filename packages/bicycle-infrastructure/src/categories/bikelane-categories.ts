/** Port of topics/roads_bikelanes/bikelanes/bikelane_categories.lua — compiled from declarative specs. */
import type { BikelaneCategory, OsmTags } from '../types.ts'
import { COMPILED_CATEGORY_DEFINITIONS, runCondition } from './compile-category-specs.ts'
import { decisionTagsView } from './decision-view.ts'

export { runCondition }
export { isCrossingPattern, hasBetweenLanesConditions } from './predicates.ts'

export const CATEGORY_DEFINITIONS: BikelaneCategory[] = COMPILED_CATEGORY_DEFINITIONS

/** First category whose condition matches; runs its `process` on the raw tags. */
export function categorizeBikelane(tags: OsmTags): BikelaneCategory | null {
  for (const category of CATEGORY_DEFINITIONS) {
    if (category.condition(decisionTagsView(tags))) {
      category.process?.(tags)
      return category
    }
  }
  return null
}
