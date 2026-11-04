import type { OsmTags } from '../types.ts'
import type { TagFix } from './types.ts'

/** The tags after the fix: `remove`, then `add`, then `change`. Returns a new object. */
export function applyTagFix(tags: OsmTags, fix: TagFix): OsmTags {
  const next: OsmTags = { ...tags }
  for (const key of fix.remove ?? []) delete next[key]
  for (const [key, value] of Object.entries(fix.add ?? {})) next[key] = value
  for (const [key, { to }] of Object.entries(fix.change ?? {})) next[key] = to
  return next
}

/** The fix that removes tags */
export function removeTagsFix(keys: readonly string[]): TagFix {
  return { message: { code: 'fix.remove_tags', params: { keys: keys.join(', ') } }, remove: keys }
}

/** The fix that sets a tag (`add` when the tag is not there yet, else `change`) */
export function setTagFix(tags: OsmTags, key: string, value: string): TagFix {
  const from = tags[key]
  return {
    message: { code: 'fix.set_tag', params: { key, value } },
    ...(from === undefined
      ? { add: { [key]: value } }
      : { change: { [key]: { from, to: value } } }),
  }
}
