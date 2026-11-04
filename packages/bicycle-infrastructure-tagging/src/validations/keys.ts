import type { OsmTags } from '../types.ts'
import type { RuleScope } from './types.ts'

/** In a key list: the tag of the infrastructure itself (`cycleway:left` on a road side) */
export const PREFIX_KEY = '{prefix}'

/**
 * The keys in `tags` that a base key is read from on a road side, most specific first:
 * `cycleway:left:width`, `cycleway:both:width`, `cycleway:width`.
 */
export function sideKeyCandidates(side: 'left' | 'right', prefix: string, base: string): string[] {
  const name = (head: string) => (base === PREFIX_KEY ? head : `${head}:${base}`)
  return [name(`${prefix}:${side}`), name(`${prefix}:both`), name(prefix)]
}

/**
 * The keys of a finding as they are in the tags. A base key that is not tagged is left out; when none
 * is tagged the key where the tag would go is returned (`cycleway:left` on a side, the first base key
 * on a way), so a finding always names a key.
 */
export function resolveKeys(
  tags: OsmTags,
  scope: RuleScope,
  prefix: string | null | undefined,
  bases: readonly string[],
): string[] {
  const found = new Set<string>()
  let fallback: string | undefined
  if (scope === 'left' || scope === 'right') {
    const head = prefix ?? 'cycleway'
    fallback = sideKeyCandidates(scope, head, PREFIX_KEY)[0]
    for (const base of bases) {
      for (const key of sideKeyCandidates(scope, head, base)) {
        if (tags[key] !== undefined) found.add(key)
      }
    }
  } else {
    const plain = bases.filter((base) => base !== PREFIX_KEY)
    fallback = plain[0]
    for (const key of plain) if (tags[key] !== undefined) found.add(key)
  }
  if (found.size) return [...found]
  return fallback ? [fallback] : []
}

/** The first key of the candidates that is tagged: a side key wins over `both`, that over the unsided key */
export function effectiveSideKey(
  tags: OsmTags,
  side: 'left' | 'right',
  prefix: string,
  base: string,
): string | undefined {
  return sideKeyCandidates(side, prefix, base).find((key) => tags[key] !== undefined)
}
