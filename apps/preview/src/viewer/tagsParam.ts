import type { OsmTags } from '@tilda-geo/bicycle-infrastructure'

/**
 * Tags in the URL: `key=value` pairs joined by `;` (`highway=cycleway;bicycle=designated`).
 * OSM uses `;` inside values too (`traffic_sign=DE:240;1022-10`): a part without `=` belongs to the
 * value before it.
 */
export function parseTagsParam(param: string): OsmTags {
  const tags: OsmTags = {}
  let lastKey: string | undefined
  for (const part of param.split(';')) {
    const index = part.indexOf('=')
    if (index > 0) {
      lastKey = part.slice(0, index).trim()
      tags[lastKey] = part.slice(index + 1).trim()
    } else if (lastKey && part.trim()) {
      tags[lastKey] = `${tags[lastKey]};${part.trim()}`
    }
  }
  return tags
}

export function serializeTagsParam(tags: OsmTags): string {
  return Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
}

/** The text area: one `key=value` per line. Lines without `=` are skipped. */
export function parseTagsText(text: string): OsmTags {
  const tags: OsmTags = {}
  for (const line of text.split('\n')) {
    const index = line.indexOf('=')
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    if (key) tags[key] = line.slice(index + 1).trim()
  }
  return tags
}

export function tagsToText(tags: OsmTags): string {
  return Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}
