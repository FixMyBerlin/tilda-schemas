/** Compile declarative category specs into runtime `BikelaneCategory[]`. */
import type { BikelaneCategory, OsmTags } from '../types.ts'
import {
  CATEGORY_MACROS,
  CATEGORY_SPECS,
  type CategorySpec,
  type RefiningChild,
} from './category-specs.ts'
import { decisionTagsView } from './decision-view.ts'
import { evalPredicate, evalPredicateStrict, type MacroRegistry } from './tag-predicate.ts'

const MACROS: MacroRegistry = { ...CATEGORY_MACROS }

function compileMatch(spec: CategorySpec): (tags: OsmTags) => boolean | undefined {
  if (!spec.match) return () => undefined
  const excludes = spec.excludes ?? []
  return (tags: OsmTags) => {
    for (const ex of excludes) {
      if (evalPredicateStrict(tags, ex, MACROS)) return false
    }
    return evalPredicate(tags, spec.match!, MACROS)
  }
}

function compileRefiningMatch(predicate: RefiningChild['match']): (tags: OsmTags) => boolean {
  return (tags: OsmTags) => evalPredicateStrict(tags, predicate, MACROS)
}

function mkCategory(
  spec: CategorySpec,
  id: string,
  condition: BikelaneCategory['condition'],
  copyFromParent?: boolean,
): BikelaneCategory {
  return {
    id,
    infrastructureExists: spec.infrastructureExists,
    implicitOneWay: spec.implicitOneWay,
    implicitOneWayConfidence: spec.implicitOneWayConfidence,
    copySurfaceSmoothnessFromParent: copyFromParent ?? spec.copySurfaceSmoothnessFromParent,
    condition,
    process: spec.process,
  }
}

function resolveRefinedId(spec: CategorySpec, child: RefiningChild): string {
  if (child.idSuffix === '_advisoryOrExclusive' && spec.id.endsWith('_advisoryOrExclusive')) {
    return spec.id
  }
  const base = spec.id.replace(/_advisoryOrExclusive$/, '')
  return `${base}${child.idSuffix}`
}

function expandRefining(
  spec: CategorySpec,
  baseMatch: (tags: OsmTags) => boolean | undefined,
): BikelaneCategory[] {
  return spec.refining!.map((child) => {
    const refineMatch = compileRefiningMatch(child.match)
    const condition: BikelaneCategory['condition'] = (tags) =>
      (baseMatch(tags) && refineMatch(tags)) || undefined
    const childSpec: CategorySpec = child.implicitOneWayConfidence
      ? { ...spec, implicitOneWayConfidence: child.implicitOneWayConfidence }
      : spec
    const copyFromParent = ['_adjoining', '_isolated', '_adjoiningOrIsolated'].includes(
      child.idSuffix,
    )
      ? false
      : undefined
    return mkCategory(childSpec, resolveRefinedId(spec, child), condition, copyFromParent)
  })
}

function expandSpec(spec: CategorySpec): BikelaneCategory[] {
  const baseMatch = compileMatch(spec)
  if (!spec.refining?.length) {
    return [mkCategory(spec, spec.id, baseMatch)]
  }
  return expandRefining(spec, baseMatch)
}

export const COMPILED_CATEGORY_DEFINITIONS: BikelaneCategory[] = CATEGORY_SPECS.flatMap(expandSpec)

export function runCondition(category: BikelaneCategory, tags: OsmTags): boolean {
  return Boolean(category.condition(decisionTagsView(tags)))
}

export function sidepathDiscriminatorKnown(tags: OsmTags): boolean {
  if (tags.is_sidepath === 'yes' || tags.is_sidepath === 'no') return true
  if (tags.highway === 'service' || tags.highway === 'track') return true
  return false
}

export function laneDiscriminatorKnown(tags: OsmTags): boolean {
  return tags.lane === 'advisory' || tags.lane === 'exclusive'
}
