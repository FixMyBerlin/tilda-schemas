/**
 * Compare the TS library output against the Tilda LUA export (ground truth).
 *
 * Reads `out/joined.ndjson` (produced by `bun run check`: raw input tags + LUA outputs
 * per OSM way), runs the TS library on the same input, matches features by side/prefix,
 * and reports per-key agreement.
 *
 *   bun run check     # produce out/joined.ndjson first
 *   bun run compare
 */
import { createReadStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { processBikelanes, type BikelaneResult } from '@tilda-geo/bicycle-infrastructure'

const JOINED = 'out/joined.ndjson'
const OUT_DIR = 'out'

type TildaOutput = {
  key: string
  prefix: string | null
  side: string
  properties: Record<string, unknown>
}
type JoinedRow = { baseRef: string; inputTags: Record<string, string>; outputs: TildaOutput[] }

const keyOf = (prefix: string | null | undefined, side: string) => `${prefix ?? 'self'}:${side}`

// Every comparable output field the library produces (not just a subset), so the
// agreement numbers reflect the full output, not a flattering slice.
const FIELDS = [
  'oneway',
  'surface',
  'surface_source',
  'surface_confidence',
  'smoothness',
  'smoothness_source',
  'smoothness_confidence',
  'separation_left',
  'separation_right',
  'buffer_left',
  'buffer_right',
  'marking_left',
  'marking_right',
  'traffic_mode_left',
  'traffic_mode_right',
  'surface_color',
  'traffic_sign',
  'width',
] as const satisfies readonly (keyof BikelaneResult)[]

/**
 * Normalized equality. null/undefined align. Numbers compare only when BOTH sides are
 * numbers (rounded); a number-vs-string is a real difference, not coerced away.
 */
function eq(a: unknown, b: unknown): boolean {
  const na = a === undefined ? null : a
  const nb = b === undefined ? null : b
  if (na === null || nb === null) return na === nb
  if (typeof na === 'number' && typeof nb === 'number') return Math.abs(na - nb) < 1e-6
  if (typeof na === 'number' || typeof nb === 'number') return false
  return String(na) === String(nb)
}

let totalTilda = 0
let matchedKey = 0
let categoryMatch = 0
let tsMissing = 0
let tsExtra = 0
const catConfusion: Record<string, number> = {}
const fieldStats = {} as Record<(typeof FIELDS)[number], { compared: number; match: number }>
for (const f of FIELDS) fieldStats[f] = { compared: 0, match: 0 }
const catMismatchSamples: unknown[] = []
const tsMissingSamples: unknown[] = []
const tsExtraSamples: unknown[] = []

const rl = createInterface({ input: createReadStream(JOINED, 'utf8'), crlfDelay: Infinity })
for await (const line of rl) {
  if (!line) continue
  const { baseRef, inputTags, outputs } = JSON.parse(line) as JoinedRow

  const tsFeatures = processBikelanes({ ...inputTags }).filter((f) => f._infrastructureExists)
  const tsByKey = new Map<string, BikelaneResult>()
  for (const f of tsFeatures) tsByKey.set(keyOf(f._prefix, f._side ?? 'self'), f)

  const seen = new Set<string>()
  for (const o of outputs) {
    totalTilda++
    const k = keyOf(o.prefix, o.side)
    const ts = tsByKey.get(k)
    if (!ts) {
      tsMissing++
      if (tsMissingSamples.length < 40)
        tsMissingSamples.push({ id: o.key, tildaCategory: o.properties.category })
      continue
    }
    seen.add(k)
    matchedKey++

    const tCat = o.properties.category as string
    const sCat = ts.category
    if (tCat === sCat) {
      categoryMatch++
    } else {
      const pair = `${tCat} => ${sCat}`
      catConfusion[pair] = (catConfusion[pair] ?? 0) + 1
      if (catMismatchSamples.length < 60) {
        catMismatchSamples.push({ id: o.key, tilda: tCat, ts: sCat, input: inputTags })
      }
    }

    for (const f of FIELDS) {
      fieldStats[f].compared++
      if (eq(o.properties[f], ts[f])) fieldStats[f].match++
    }
  }

  for (const [k, f] of tsByKey) {
    if (!seen.has(k)) {
      tsExtra++
      if (tsExtraSamples.length < 40)
        tsExtraSamples.push({ baseRef, key: k, tsCategory: f.category })
    }
  }
}

const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(2)}%`)

// Honest denominator: a feature only one side emitted is a disagreement, not omitted.
// `categoryMatchRate` is over matched keys only; `overallAgreementRate` is over the union
// (matched + tsMissing + tsExtra) so the headline can't read 100% while features diverge.
const unionFeatures = matchedKey + tsMissing + tsExtra

const summary = {
  tildaFeatures: totalTilda,
  matchedByKey: matchedKey,
  categoryMatch,
  categoryMatchRate: pct(categoryMatch, matchedKey),
  overallAgreementRate: pct(categoryMatch, unionFeatures),
  tsMissingFeatures: tsMissing, // Tilda emitted a feature the TS library did not
  tsExtraFeatures: tsExtra, // TS library emitted a feature Tilda did not
  fieldAgreement: Object.fromEntries(
    FIELDS.map((f) => [
      f,
      { rate: pct(fieldStats[f].match, fieldStats[f].compared), ...fieldStats[f] },
    ]),
  ),
  topCategoryConfusion: Object.fromEntries(
    Object.entries(catConfusion)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25),
  ),
}

await mkdir(OUT_DIR, { recursive: true })
await Bun.write(`${OUT_DIR}/compare-summary.json`, JSON.stringify(summary, null, 2))
await Bun.write(
  `${OUT_DIR}/compare-category-mismatches.json`,
  JSON.stringify(catMismatchSamples, null, 2),
)
await Bun.write(`${OUT_DIR}/compare-ts-missing.json`, JSON.stringify(tsMissingSamples, null, 2))
await Bun.write(`${OUT_DIR}/compare-ts-extra.json`, JSON.stringify(tsExtraSamples, null, 2))

console.log('\n── TS library vs Tilda export ───────────────────────────')
console.log(`Tilda features          ${totalTilda}`)
console.log(`matched by side/prefix  ${matchedKey}  (${pct(matchedKey, totalTilda)})`)
console.log(
  `category agreement      ${categoryMatch}/${matchedKey}  (${pct(categoryMatch, matchedKey)} of matched)`,
)
console.log(`TS missing (Tilda-only) ${tsMissing}`)
console.log(`TS extra  (TS-only)     ${tsExtra}`)
console.log(
  `overall agreement       ${categoryMatch}/${unionFeatures}  (${pct(categoryMatch, unionFeatures)} of union, incl. missing+extra)`,
)
console.log('\nfield agreement (on matched features):')
for (const f of FIELDS)
  console.log(`  ${f.padEnd(20)} ${pct(fieldStats[f].match, fieldStats[f].compared)}`)
console.log('\ntop category confusion (tilda => ts):')
for (const [pair, n] of Object.entries(summary.topCategoryConfusion))
  console.log(`  ${String(n).padStart(5)}  ${pair}`)
console.log(
  `\nArtifacts in ${OUT_DIR}/ (compare-summary.json, compare-category-mismatches.json, compare-ts-missing.json, compare-ts-extra.json)`,
)
