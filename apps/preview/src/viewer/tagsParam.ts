import type { OsmTags } from '@tilda-geo/bicycle-infrastructure'

/**
 * Tags in the URL: `key=value` pairs joined by `;` (`highway=cycleway;bicycle=designated`).
 * OSM uses `;` inside values too (`traffic_sign=DE:240;1022-10`): a part without `=` belongs to the
 * value before it, so these links stay readable.
 *
 * A value whose `;` would not read back like that (`note=first;then a=b` starts a new tag) gets all
 * its `;` written as `\;`, and a `\` in a value is written as `\\`, so every value survives the round
 * trip.
 */
export function parseTagsParam(param: string): OsmTags {
  const tags: OsmTags = {}
  let lastKey: string | undefined
  for (const part of splitUnescaped(param)) {
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
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${escapeValue(value)}`)
    .join(';')
}

/**
 * `\` → `\\`. The `;` stay plain when every part after one reads back as it is (not empty, no `=`,
 * no spaces at its ends, as in `asphalt;paving_stones`); otherwise all of them become `\;`.
 */
function escapeValue(value: string): string {
  const escaped = value.replaceAll('\\', '\\\\')
  const plainIsSafe = escaped
    .split(';')
    .slice(1)
    .every((part) => part !== '' && !part.includes('=') && part === part.trim())
  return plainIsSafe ? escaped : escaped.replaceAll(';', '\\;')
}

/** Splits at `;` that are not escaped and resolves `\;` and `\\` */
function splitUnescaped(param: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let index = 0; index < param.length; index++) {
    const char = param[index]!
    const next = param[index + 1]
    if (char === '\\' && (next === ';' || next === '\\')) {
      current += next
      index++
    } else if (char === ';') {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts
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
