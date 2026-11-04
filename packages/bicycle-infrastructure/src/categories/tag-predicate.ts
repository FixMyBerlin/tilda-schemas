import { containsSubstring, hasPrefix, hasSuffix, hasTagWithPrefix } from '../helpers/strings.ts'
/** Small predicate AST for declarative category specs (OSMnexus-inspired). */
import type { OsmTags } from '../types.ts'

export type TagPredicate =
  | { op: 'eq'; key: string; value: string }
  | { op: 'neq'; key: string; value: string }
  | { op: 'in'; key: string; values: string[] }
  | { op: 'notIn'; key: string; values: string[] }
  | { op: 'exists'; key: string }
  | { op: 'notExists'; key: string }
  | { op: 'includes'; key: string; substring: string }
  | { op: 'hasPrefix'; key: string; prefix: string }
  | { op: 'hasSuffix'; key: string; suffix: string }
  | { op: 'hasTagWithPrefix'; prefix: string }
  | { op: 'and'; predicates: TagPredicate[] }
  | { op: 'or'; predicates: TagPredicate[] }
  | { op: 'not'; predicate: TagPredicate }
  | { op: 'macro'; name: string }
  | { op: 'literal'; value: boolean }

/** Named predicates backed by imperative helpers (complex OSM logic). */
export type MacroRegistry = Record<string, (tags: OsmTags) => boolean | undefined>

export const pred = {
  eq: (key: string, value: string): TagPredicate => ({ op: 'eq', key, value }),
  neq: (key: string, value: string): TagPredicate => ({ op: 'neq', key, value }),
  in: (key: string, values: string[]): TagPredicate => ({ op: 'in', key, values }),
  notIn: (key: string, values: string[]): TagPredicate => ({ op: 'notIn', key, values }),
  exists: (key: string): TagPredicate => ({ op: 'exists', key }),
  notExists: (key: string): TagPredicate => ({ op: 'notExists', key }),
  includes: (key: string, substring: string): TagPredicate => ({ op: 'includes', key, substring }),
  hasPrefix: (key: string, prefix: string): TagPredicate => ({ op: 'hasPrefix', key, prefix }),
  hasSuffix: (key: string, suffix: string): TagPredicate => ({ op: 'hasSuffix', key, suffix }),
  hasTagWithPrefix: (prefix: string): TagPredicate => ({ op: 'hasTagWithPrefix', prefix }),
  and: (...predicates: TagPredicate[]): TagPredicate => ({ op: 'and', predicates }),
  or: (...predicates: TagPredicate[]): TagPredicate => ({ op: 'or', predicates }),
  not: (predicate: TagPredicate): TagPredicate => ({ op: 'not', predicate }),
  macro: (name: string): TagPredicate => ({ op: 'macro', name }),
  literal: (value: boolean): TagPredicate => ({ op: 'literal', value }),
} as const

function tagValue(tags: OsmTags, key: string): string | undefined {
  return tags[key]
}

export function evalPredicate(
  tags: OsmTags,
  predicate: TagPredicate,
  macros: MacroRegistry,
): boolean | undefined {
  switch (predicate.op) {
    case 'eq':
      return tagValue(tags, predicate.key) === predicate.value || undefined
    case 'neq':
      return tagValue(tags, predicate.key) !== predicate.value || undefined
    case 'in': {
      const v = tagValue(tags, predicate.key)
      return (v != null && predicate.values.includes(v)) || undefined
    }
    case 'notIn': {
      const v = tagValue(tags, predicate.key)
      return (v != null && !predicate.values.includes(v)) || undefined
    }
    case 'exists':
      return tagValue(tags, predicate.key) != null || undefined
    case 'notExists':
      return tagValue(tags, predicate.key) == null || undefined
    case 'includes':
      return containsSubstring(tagValue(tags, predicate.key), predicate.substring) || undefined
    case 'hasPrefix':
      return hasPrefix(tagValue(tags, predicate.key), predicate.prefix) || undefined
    case 'hasSuffix':
      return hasSuffix(tagValue(tags, predicate.key), predicate.suffix) || undefined
    case 'hasTagWithPrefix':
      return hasTagWithPrefix(tags, predicate.prefix) || undefined
    case 'and': {
      let hasUndefined = false
      for (const child of predicate.predicates) {
        const r = evalPredicate(tags, child, macros)
        if (r === false) return false
        if (r !== true) hasUndefined = true
      }
      return hasUndefined ? undefined : true
    }
    case 'or': {
      let hasUndefined = false
      for (const child of predicate.predicates) {
        const r = evalPredicate(tags, child, macros)
        if (r === true) return true
        if (r !== false) hasUndefined = true
      }
      return hasUndefined ? undefined : false
    }
    case 'not': {
      const r = evalPredicate(tags, predicate.predicate, macros)
      if (r === true) return false
      if (r === false) return true
      return undefined
    }
    case 'macro': {
      const fn = macros[predicate.name]
      if (!fn) throw new Error(`Unknown predicate macro: ${predicate.name}`)
      return fn(tags)
    }
    case 'literal':
      return predicate.value
    default: {
      const _exhaustive: never = predicate
      throw new Error(`Unknown predicate op: ${(_exhaustive as TagPredicate).op}`)
    }
  }
}

/** AND semantics with explicit false propagation (for excludes). */
export function evalPredicateStrict(
  tags: OsmTags,
  predicate: TagPredicate,
  macros: MacroRegistry,
): boolean {
  const r = evalPredicate(tags, predicate, macros)
  return r === true
}
