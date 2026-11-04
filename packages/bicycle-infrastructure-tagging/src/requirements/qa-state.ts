import { isIncompleteCategoryId, processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import type { OsmTags } from '../types.ts'
import { isRoad, requiredAttributes, roadAttributes } from './required-attributes.ts'
import type { RequiredAttribute, RequirementsProfile } from './types.ts'

/**
 * How complete a way is tagged, from the same list as the required attributes: worst state over
 * the way itself, its sides and (for roads without bike infrastructure on the way itself) the road
 * list.
 * - `unclear`: TILDA cannot decide the category (`needsClarification`, `*_adjoiningOrIsolated`, `*_advisoryOrExclusive`)
 * - `incomplete`: a required tag is missing, not accepted by TILDA, or only guessed
 * - `complete`: all required tags are there
 */
export type QaState = 'complete' | 'incomplete' | 'unclear'

export type QaResult = {
  state: QaState
  /** the way has bike infrastructure (itself or on a side) */
  bike: boolean
}

const RANK: Record<QaState, number> = { complete: 0, incomplete: 1, unclear: 2 }

function worst(a: QaState, b: QaState): QaState {
  return RANK[b] > RANK[a] ? b : a
}

function attributesState(attributes: RequiredAttribute[]): QaState {
  const open = attributes.some(
    (a) => !a.optional && (a.state === 'missing' || a.state === 'ignored' || a.state === 'guess'),
  )
  return open ? 'incomplete' : 'complete'
}

/** `undefined` for ways that are neither bike infrastructure nor a road */
export function tildaQaState(tags: OsmTags, profile: RequirementsProfile): QaResult | undefined {
  if (!tags.highway) return undefined

  let results: ReturnType<typeof processBikelanes>
  try {
    results = processBikelanes(tags)
  } catch {
    return undefined
  }

  let state: QaState | undefined
  let bike = false
  for (const result of results) {
    if (!result._infrastructureExists) continue
    bike = true
    const resultState = isIncompleteCategoryId(result.category)
      ? 'unclear'
      : attributesState(requiredAttributes(result, tags, { profile }))
    state = worst(state ?? 'complete', resultState)
  }

  const selfIsInfrastructure = results.some((r) => r._side === 'self' && r._infrastructureExists)
  if (!selfIsInfrastructure && isRoad(tags)) {
    state = worst(state ?? 'complete', attributesState(roadAttributes(tags, { profile })))
  }

  return state ? { state, bike } : undefined
}

/** Entity tags are immutable per version, so the result can be cached per tags object */
const cache = new WeakMap<RequirementsProfile, WeakMap<OsmTags, string[]>>()

/**
 * CSS classes for a QA lens on a map: `tilda-qa tilda-qa-<state> tilda-qa-bike|road`. Cached per
 * tags object, so pass the same object while the entity does not change.
 */
export function tildaQaClasses(tags: OsmTags, profile: RequirementsProfile): string[] {
  let perTags = cache.get(profile)
  if (!perTags) {
    perTags = new WeakMap()
    cache.set(profile, perTags)
  }
  let classes = perTags.get(tags)
  if (!classes) {
    const qa = tildaQaState(tags, profile)
    classes = qa
      ? ['tilda-qa', `tilda-qa-${qa.state}`, qa.bike ? 'tilda-qa-bike' : 'tilda-qa-road']
      : []
    perTags.set(tags, classes)
  }
  return classes
}
