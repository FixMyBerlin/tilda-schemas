import {
  lineRelationToRoad,
  pickSidepathRoad,
  type LineRelationOptions,
  type WayGeometry,
} from '../geometry/line-relation.ts'
import type { Finding, ValidationOptions } from './types.ts'
import { validateTags } from './validate.ts'

/**
 * The rule `sidepath_line_against_traffic` with the geometry: picks the road of the way out of the
 * roads near it (`pickSidepathRoad`), measures how the line runs next to it (`lineRelationToRoad`) and
 * checks the tags. The editor only finds the roads near the way (e.g. within 25 m) and passes them.
 * Runs with the profile `radnetz-berlin` unless `options.profile` says otherwise.
 */
export function sidepathDirectionFindings(
  way: WayGeometry,
  roads: readonly WayGeometry[],
  options: ValidationOptions & { geometry?: LineRelationOptions } = {},
): Finding[] {
  const { geometry, ...validation } = options
  const road = pickSidepathRoad(way.coords, roads, geometry)
  const lineRelation = road && lineRelationToRoad(way.coords, road, geometry)
  if (!lineRelation) return []
  return validateTags(way.tags, {
    profile: 'radnetz-berlin',
    ...validation,
    lineRelation,
    only: ['sidepath_line_against_traffic'],
  })
}
