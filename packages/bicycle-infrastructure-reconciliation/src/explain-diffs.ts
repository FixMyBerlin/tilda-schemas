/**
 * Group the differences between the TS library and an older Tilda LUA export by cause.
 *
 * The Berlin snapshot is from 2026-06-12. Since then tilda-geo changed rules (unsigned cycleway,
 * widths, riding direction), so `compare` shows differences that are not porting errors. This script
 * counts them by the rule that explains them and prints examples, so a new difference stands out.
 *
 *   bun run check     # produce out/joined.ndjson first
 *   bun run explain-diffs
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import {
  BIKELANE_TRANSFORMATIONS,
  getTransformedObjects,
  prepareTags,
  processBikelanes,
  type BikelaneResult,
  type OsmTags,
} from '@tilda-geo/bicycle-infrastructure'

type TildaOutput = {
  key: string
  prefix: string | null
  side: string
  properties: Record<string, unknown>
}
type JoinedRow = { baseRef: string; inputTags: OsmTags; outputs: TildaOutput[] }

const keyOf = (prefix: string | null | undefined, side: string) => `${prefix ?? 'self'}:${side}`

type Group = { count: number; examples: string[] }
const groups: Record<string, Record<string, Group>> = {
  category: {},
  oneway: {},
  width: {},
  'TS only': {},
}
function add(topic: keyof typeof groups, cause: string, example: string) {
  const causes = (groups[topic] ??= {})
  const group = (causes[cause] ??= { count: 0, examples: [] })
  group.count++
  if (group.examples.length < 3) group.examples.push(example)
}

/** The transformed tags of one feature, to see which tags the rule had to read. */
function transformedTagsOf(inputTags: OsmTags, feature: BikelaneResult): OsmTags | undefined {
  const tags: OsmTags = { ...inputTags }
  prepareTags(tags)
  return getTransformedObjects(tags, BIKELANE_TRANSFORMATIONS).find(
    (t) => (t._side ?? 'self') === feature._side && (t._prefix ?? null) === feature._prefix,
  )
}

function onewayCause(
  tilda: unknown,
  ts: BikelaneResult,
  inputTags: OsmTags,
  transformed?: OsmTags,
): string {
  const side = ts._side
  const own = transformed?.oneway
  const hasMinusOne = Object.values(inputTags).includes('-1')
  if (side !== 'self' && own === undefined && ts.oneway === 'implicit_yes') {
    return `${tilda} => implicit_yes: lane on the road without ${ts._prefix}:<side>:oneway (side default)`
  }
  if (own === '-1' || inputTags['oneway:bicycle'] === '-1' || (side === 'self' && hasMinusOne)) {
    return `${tilda} => ${ts.oneway}: oneway=-1 is explicit now`
  }
  return `${tilda} => ${ts.oneway}: other`
}

let compared = 0
const rl = createInterface({ input: createReadStream('out/joined.ndjson', 'utf8') })
for await (const line of rl) {
  if (!line) continue
  const { baseRef, inputTags, outputs } = JSON.parse(line) as JoinedRow
  const tsFeatures = processBikelanes({ ...inputTags }).filter((f) => f._infrastructureExists)
  const tsByKey = new Map(tsFeatures.map((f) => [keyOf(f._prefix, f._side), f]))
  const seen = new Set<string>()

  for (const output of outputs) {
    const key = keyOf(output.prefix, output.side)
    const ts = tsByKey.get(key)
    if (!ts) continue
    seen.add(key)
    compared++
    const tilda = output.properties

    if (tilda.category !== ts.category) {
      const rule =
        inputTags.highway === 'cycleway' && ['none', 'no'].includes(inputTags.traffic_sign ?? '')
          ? 'highway=cycleway + traffic_sign=none (98e649800)'
          : 'other'
      add('category', `${tilda.category} => ${ts.category}: ${rule}`, output.key)
    }

    if ((tilda.oneway ?? null) !== (ts.oneway ?? null)) {
      const transformed = transformedTagsOf(inputTags, ts)
      add('oneway', onewayCause(tilda.oneway, ts, inputTags, transformed), output.key)
    }

    const tildaWidth = (tilda.width ?? null) as number | null
    const tsWidth = ts.width ?? null
    if (tildaWidth !== tsWidth) {
      const cause =
        tildaWidth === 0 && tsWidth === null
          ? 'width 0 is no width now (parse_width)'
          : 'other (probably export and Overpass date)'
      add('width', cause, output.key)
    }
  }

  for (const [key, feature] of tsByKey) {
    if (seen.has(key)) continue
    add('TS only', `${feature.category} on ${key}`, baseRef)
  }
}

console.log(`\nFeatures compared: ${compared}`)
for (const [topic, causes] of Object.entries(groups)) {
  console.log(`\n── ${topic} ──`)
  const entries = Object.entries(causes).sort((a, b) => b[1].count - a[1].count)
  if (entries.length === 0) console.log('  no differences')
  for (const [cause, { count, examples }] of entries) {
    console.log(`${String(count).padStart(6)}  ${cause}\n          e.g. ${examples.join(', ')}`)
  }
}
