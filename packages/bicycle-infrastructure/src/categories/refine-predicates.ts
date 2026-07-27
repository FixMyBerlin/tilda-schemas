/** Declarative predicates for refining subcategories (sidepath / lane splits). */
import { pred, type TagPredicate } from './tag-predicate.ts'

/** Mirrors category_is_sidepath.lua — proxy tags that imply a sidepath. */
export const CATEGORY_IS_SIDEPATH_PRED: TagPredicate = pred.or(
  pred.eq('is_sidepath', 'yes'),
  pred.exists('_parent_highway'),
  pred.eq('footway', 'sidewalk'),
  pred.eq('path', 'sidewalk'),
  pred.eq('path', 'sidepath'),
  pred.eq('cycleway', 'sidepath'),
  pred.eq('steps', 'sidewalk'),
)

export const SIDEPATH_ADJOINING_PRED: TagPredicate = pred.and(
  CATEGORY_IS_SIDEPATH_PRED,
  pred.neq('is_sidepath', 'no'),
)

export const SIDEPATH_ISOLATED_PRED: TagPredicate = pred.or(
  pred.eq('is_sidepath', 'no'),
  pred.eq('highway', 'service'),
  pred.eq('highway', 'track'),
)

/** Ambiguous sidepath: base matches but adjoining/isolated discriminators are unknown. */
export const SIDEPATH_UNKNOWN_PRED: TagPredicate = pred.and(
  pred.neq('is_sidepath', 'yes'),
  pred.notExists('_parent_highway'),
  pred.neq('footway', 'sidewalk'),
  pred.neq('path', 'sidewalk'),
  pred.neq('path', 'sidepath'),
  pred.neq('cycleway', 'sidepath'),
  pred.neq('steps', 'sidewalk'),
  pred.neq('is_sidepath', 'no'),
  pred.notIn('highway', ['service', 'track']),
)

export function advisoryOrExclusiveRefining(laneKey = 'lane') {
  return [
    { idSuffix: '_advisory', match: pred.eq(laneKey, 'advisory'), implicitOneWayConfidence: 'high' as const },
    { idSuffix: '_exclusive', match: pred.eq(laneKey, 'exclusive'), implicitOneWayConfidence: 'high' as const },
    {
      idSuffix: '_advisoryOrExclusive',
      match: pred.or(pred.notExists(laneKey), pred.notIn(laneKey, ['advisory', 'exclusive'])),
    },
  ]
}

export const ADJOINING_OR_ISOLATED_REFINING = [
  { idSuffix: '_adjoining', match: SIDEPATH_ADJOINING_PRED },
  { idSuffix: '_isolated', match: SIDEPATH_ISOLATED_PRED },
  { idSuffix: '_adjoiningOrIsolated', match: SIDEPATH_UNKNOWN_PRED },
] as const
