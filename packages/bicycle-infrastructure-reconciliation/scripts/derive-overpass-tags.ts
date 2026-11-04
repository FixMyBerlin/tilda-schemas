/**
 * Derive a lean tags index from the heavy Overpass reference (no network).
 *
 * The full `overpass-berlin-raw.json` (~311MB) carries geometry we don't need for the
 * id-based cross-check. This writes `overpass-berlin-tags.ndjson` — one
 * `{"id":<number>,"tags":{...}}` per line — so the check script can stream it with low
 * memory and treat it as the canonical raw-input index.
 *
 *   bun --smol scripts/derive-overpass-tags.ts
 */
import { statSync } from 'node:fs'

const IN = 'reference/overpass-berlin-raw.json'
const OUT = 'reference/overpass-berlin-tags.ndjson'

console.log(`Reading ${IN} ...`)
const data = (await Bun.file(IN).json()) as {
  elements: Array<{ type: string; id: number; tags?: Record<string, string> }>
}

const lines: string[] = []
let withTags = 0
for (const el of data.elements) {
  if (el.type !== 'way') continue
  lines.push(JSON.stringify({ id: el.id, tags: el.tags ?? {} }))
  if (el.tags) withTags++
}

await Bun.write(OUT, lines.join('\n') + '\n')
console.log(
  `Wrote ${OUT} (${statSync(OUT).size} bytes, ${lines.length} ways, ${withTags} with tags).`,
)
