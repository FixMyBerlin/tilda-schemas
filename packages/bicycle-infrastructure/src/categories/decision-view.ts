/**
 * Port of the `decision_tags_view` from bikelane_categories.lua.
 *
 * A read-view over tags where:
 *  - `<base>_left` / `<base>_right` resolve via the matching sided sanitizer
 *    (e.g. `separation_left` -> SANITIZE_ROAD_TAGS.separation(tags, 'left')),
 *  - any value equal to the DISALLOWED sentinel reads as missing (undefined).
 * Writes pass straight through to the underlying tags so category `process` and later
 * derivations observe mutations.
 */
import type { OsmTags } from '../types.ts'
import { DISALLOWED } from '../types.ts'
import { SIDED_SANITIZERS } from '../sanitize/sanitize-road-tags.ts'

const IS_DECISION_VIEW = Symbol('isDecisionView')

function resolveSided(source: OsmTags, key: string): { handled: boolean; value?: unknown } {
  let base: string | undefined
  let side: 'left' | 'right' | undefined
  if (key.endsWith('_left')) {
    base = key.slice(0, -'_left'.length)
    side = 'left'
  } else if (key.endsWith('_right')) {
    base = key.slice(0, -'_right'.length)
    side = 'right'
  }
  if (base === undefined || side === undefined) return { handled: false }
  const sanitizer = SIDED_SANITIZERS[base]
  if (!sanitizer) return { handled: false }
  const value = sanitizer(source, side)
  if (value === DISALLOWED) return { handled: true, value: undefined }
  return { handled: true, value }
}

export function decisionTagsView(source: OsmTags): OsmTags {
  if ((source as Record<symbol, unknown>)[IS_DECISION_VIEW]) return source
  return new Proxy(source, {
    get(target, key) {
      if (key === IS_DECISION_VIEW) return true
      if (typeof key !== 'string') return (target as Record<symbol, unknown>)[key as symbol]
      const sided = resolveSided(target, key)
      if (sided.handled) return sided.value
      const value = target[key]
      return value === DISALLOWED ? undefined : value
    },
    set(target, key, value) {
      if (typeof key === 'string') target[key] = value as string | undefined
      else (target as Record<symbol, unknown>)[key as symbol] = value
      return true
    },
  }) as OsmTags
}
