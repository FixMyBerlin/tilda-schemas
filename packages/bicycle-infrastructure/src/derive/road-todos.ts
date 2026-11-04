/**
 * Port of topics/roads_bikelanes/roads/road_todo_categories.lua (tilda-geo `develop`, 2026-11-04).
 *
 * A road todo is a reason why a road (the way itself, not one of its lanes) is not tagged well
 * enough. Same shape as the bikelane todos; they are derived from the tags of the way and what was
 * derived for it.
 *
 * Not ported, because it needs data that is not an OSM tag:
 * - `adjoining_of_vs_csv` (sidepath CSV),
 * - the priority (`prio1` / `prio2`, set by the Mapillary coverage pseudo tag).
 */
import { parseWidth } from '../helpers/parse-length.ts'
import type { OsmTags } from '../types.ts'
import { isUnusualWidth } from './bikelane-todos.ts'

/** What the road todo conditions read besides the tags (LUA `result_tags`). */
export interface RoadTodoResult {
  /** `width` of the road, read by `parseWidth` */
  width?: number | null
  /**
   * `true` when the `self` bikelane row of the way has the todo `unusual_width` already
   * (`_self_bikelane_has_unusual_width` in LUA): one todo per way.
   */
  selfBikelaneHasUnusualWidth?: boolean
}

export interface RoadTodoDefinition {
  id: string
  desc: string
  /** `true`: hidden from the inspector, only in the todo table. */
  todoTableOnly: boolean
  condition: (tags: OsmTags, result: RoadTodoResult) => boolean
}

const deprecatedCyclewayShared: RoadTodoDefinition = {
  id: 'deprecated_cycleway_shared',
  desc: 'The tagging `cycleway=shared` is deprecated and should be replaced or removed.',
  todoTableOnly: false,
  condition: (tags) => tags.cycleway === 'shared',
}

const unusualWidth: RoadTodoDefinition = {
  id: 'unusual_width',
  desc: 'Width that we cannot read or that is unusually high. Fix `width`, or confirm it with `check_date=*` or `check_date:width=*`.',
  todoTableOnly: true,
  // One todo per way: skip it when the self row in `bikelanes` has it already. A self row can read
  // another value (`cycleway:width`, `width:lanes`), so a self row alone is not enough.
  condition: (tags, result) => !result.selfBikelaneHasUnusualWidth && isUnusualWidth(tags, result),
}

/** In the order of `road_todo_categories` in LUA (without `adjoining_of_vs_csv`). */
export const ROAD_TODOS: readonly RoadTodoDefinition[] = [deprecatedCyclewayShared, unusualWidth]

/**
 * The todos of a road (the way itself). `result.width` defaults to what `parseWidth` reads from
 * `tags.width`, like the roads table does.
 */
export function deriveRoadTodos(tags: OsmTags, result: RoadTodoResult = {}): string[] {
  const resolved: RoadTodoResult = {
    ...result,
    width: result.width !== undefined ? result.width : (parseWidth(tags.width) ?? null),
  }
  return ROAD_TODOS.filter((todo) => todo.condition(tags, resolved)).map((todo) => todo.id)
}
