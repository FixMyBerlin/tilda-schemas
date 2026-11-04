/**
 * lua-check — reconcile the Tilda LUA output against the raw OSM input.
 *
 * This is the data layer of the cross-check. It joins, by OSM id:
 *   - raw input tags  (Overpass: reference/overpass-berlin-tags.ndjson)
 *   - LUA output       (Tilda:    reference/tilda-bikelanes-berlin.geojson)
 *
 * and sorts every Tilda feature into one of three buckets:
 *   - matched           base way found in the raw input  -> ready for spec assertions
 *   - constructionGap   base way absent AND lifecycle is construction/blocked
 *                       (expected: the Overpass query does not fetch `highway=construction`;
 *                        Tilda resolves those via transform_lifecycle_tags.lua) -> FLAGGED, handle later
 *   - unexpectedMissing base way absent for any other reason -> a real anomaly to investigate
 *
 * The `matched` rows are written to `out/joined.ndjson` as `{ baseRef, inputTags, outputs }`.
 * That is the input→output dataset the future spec-assertion step consumes:
 * the spec says, per input-tag combination, what each output key (category, surface, …)
 * must be — and both this LUA output and the TS library output get checked against it.
 *
 *   bun src/check.ts [tildaGeojson] [overpassNdjson]
 */
import { createReadStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { parseTildaId } from './parse-id.ts'

const tildaPath = process.argv[2] ?? 'reference/tilda-bikelanes-berlin.geojson'
const overpassPath = process.argv[3] ?? 'reference/overpass-berlin-tags.ndjson'
const OUT_DIR = 'out'

/** Tilda `lifecycle` values that explain a missing raw input under the current query. */
const LIFECYCLE_GAP = new Set(['construction', 'construction_no_access', 'blocked'])

type TildaProps = Record<string, unknown> & {
  id: string
  category?: string
  lifecycle?: string | null
}
interface OutputFeature {
  key: string
  prefix: string | null
  side: string
  properties: TildaProps
}

// --- 1. Load Tilda output, group features by base OSM way ---------------------
console.log(`Loading Tilda output: ${tildaPath}`)
const tilda = (await Bun.file(tildaPath).json()) as { features: Array<{ properties: TildaProps }> }

const outputsByBase = new Map<number, OutputFeature[]>()
const baseRefById = new Map<number, string>()
for (const f of tilda.features) {
  const p = parseTildaId(f.properties.id)
  const list = outputsByBase.get(p.baseId) ?? []
  list.push({ key: p.key, prefix: p.prefix, side: p.side, properties: f.properties })
  outputsByBase.set(p.baseId, list)
  baseRefById.set(p.baseId, p.baseRef)
}
const neededBaseIds = outputsByBase
console.log(`  ${tilda.features.length} features across ${neededBaseIds.size} base ways`)

// --- 2. Stream raw input, keep tags only for ways Tilda emitted --------------
console.log(`Streaming raw input: ${overpassPath}`)
const inputTags = new Map<number, Record<string, string>>()
let inputTotal = 0
let inputWithNoOutput = 0
const noOutputSample: number[] = []

const rl = createInterface({ input: createReadStream(overpassPath, 'utf8'), crlfDelay: Infinity })
for await (const line of rl) {
  if (!line) continue
  const { id, tags } = JSON.parse(line) as { id: number; tags: Record<string, string> }
  inputTotal++
  if (neededBaseIds.has(id)) {
    inputTags.set(id, tags)
  } else {
    inputWithNoOutput++
    if (noOutputSample.length < 10) noOutputSample.push(id)
  }
}
console.log(
  `  ${inputTotal} raw ways (${inputWithNoOutput} produced no Tilda output / were filtered)`,
)

// --- 3. Join + bucket ---------------------------------------------------------
const matched: Array<{
  baseRef: string
  inputTags: Record<string, string>
  outputs: OutputFeature[]
}> = []
const constructionGap: OutputFeature[] = []
const unexpectedMissing: OutputFeature[] = []

for (const [baseId, outputs] of outputsByBase) {
  const tags = inputTags.get(baseId)
  if (tags) {
    matched.push({ baseRef: baseRefById.get(baseId)!, inputTags: tags, outputs })
    continue
  }
  for (const o of outputs) {
    if (LIFECYCLE_GAP.has(String(o.properties.lifecycle ?? ''))) constructionGap.push(o)
    else unexpectedMissing.push(o)
  }
}

// --- 4. Tally ----------------------------------------------------------------
const matchedFeatureCount = matched.reduce((n, m) => n + m.outputs.length, 0)
const byCategory: Record<string, number> = {}
for (const m of matched)
  for (const o of m.outputs) {
    const c = String(o.properties.category ?? '(none)')
    byCategory[c] = (byCategory[c] ?? 0) + 1
  }
const gapByLifecycle: Record<string, number> = {}
for (const o of constructionGap) {
  const l = String(o.properties.lifecycle ?? '(none)')
  gapByLifecycle[l] = (gapByLifecycle[l] ?? 0) + 1
}

const summary = {
  inputs: { totalRawWays: inputTotal, producedNoOutput: inputWithNoOutput, noOutputSample },
  outputs: { totalFeatures: tilda.features.length, baseWays: neededBaseIds.size },
  buckets: {
    matchedBaseWays: matched.length,
    matchedFeatures: matchedFeatureCount,
    constructionGapFeatures: constructionGap.length,
    unexpectedMissingFeatures: unexpectedMissing.length,
  },
  matchedByCategory: Object.fromEntries(Object.entries(byCategory).sort((a, b) => b[1] - a[1])),
  constructionGapByLifecycle: gapByLifecycle,
}

// --- 5. Write artifacts ------------------------------------------------------
await mkdir(OUT_DIR, { recursive: true })
await Bun.write(`${OUT_DIR}/summary.json`, JSON.stringify(summary, null, 2))
await Bun.write(
  `${OUT_DIR}/construction-diff.json`,
  JSON.stringify(
    constructionGap.map((o) => ({
      id: o.key,
      category: o.properties.category,
      lifecycle: o.properties.lifecycle,
    })),
    null,
    2,
  ),
)
await Bun.write(
  `${OUT_DIR}/anomalies.json`,
  JSON.stringify(
    unexpectedMissing.map((o) => ({
      id: o.key,
      category: o.properties.category,
      lifecycle: o.properties.lifecycle,
    })),
    null,
    2,
  ),
)
await Bun.write(`${OUT_DIR}/joined.ndjson`, matched.map((m) => JSON.stringify(m)).join('\n') + '\n')

// --- 6. Report ---------------------------------------------------------------
const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(2)}%`
console.log('\n── lua-check reconciliation ─────────────────────────────')
console.log(
  `matched base ways      ${matched.length} / ${neededBaseIds.size}  (${pct(matched.length, neededBaseIds.size)})`,
)
console.log(
  `matched features       ${matchedFeatureCount} / ${tilda.features.length}  (${pct(matchedFeatureCount, tilda.features.length)})`,
)
console.log(
  `construction gap       ${constructionGap.length}  (flagged, handle later) ${JSON.stringify(gapByLifecycle)}`,
)
console.log(
  `unexpected missing     ${unexpectedMissing.length}  ${unexpectedMissing.length ? '⚠️  investigate out/anomalies.json' : '✅'}`,
)
console.log(
  `\nArtifacts written to ${OUT_DIR}/ (summary.json, joined.ndjson, construction-diff.json, anomalies.json)`,
)

if (unexpectedMissing.length > 0) process.exitCode = 1
