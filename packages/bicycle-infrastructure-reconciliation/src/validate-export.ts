/**
 * Validate the Tilda LUA export against the draft attributes output schema.
 *
 * Checks that every exported feature's properties use only values from the controlled
 * vocabulary in schemas/bicycle-infrastructure-attributes/schema/output.schema.json.
 *
 *   bun run validate-export
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { mkdir } from 'node:fs/promises'
import schema from '../../../schemas/bicycle-infrastructure-attributes/schema/output.schema.json'
import { parseFeatureLine } from './geojson-feature-line.ts'

const EXPORT = process.argv[2] ?? 'reference/tilda-bikelanes-berlin.geojson'
const OUT_DIR = 'out'

type SchemaNode = { enum?: unknown[]; $ref?: string }
const defs = (schema as { $defs?: Record<string, SchemaNode> }).$defs ?? {}
const props = (schema as { properties: Record<string, SchemaNode> }).properties

/** property name → Set of allowed values (null allowed implicitly), for enum props only. */
const allowedByProp = new Map<string, Set<unknown>>()
for (const [name, node] of Object.entries(props)) {
  let n: SchemaNode = node
  if (n.$ref) {
    const key = n.$ref.replace('#/$defs/', '')
    n = defs[key] ?? {}
  }
  if (n.enum) allowedByProp.set(name, new Set(n.enum))
}

const violations: Record<string, { count: number; values: Record<string, number> }> = {}
let features = 0

const rl = createInterface({ input: createReadStream(EXPORT, 'utf8'), crlfDelay: Infinity })
for await (const raw of rl) {
  const feature = parseFeatureLine(raw)
  if (!feature) continue
  features++
  const p = feature.properties
  for (const [name, allowed] of allowedByProp) {
    const value = p[name]
    if (value === null || value === undefined) continue
    if (!allowed.has(value)) {
      const v = (violations[name] ??= { count: 0, values: {} })
      v.count++
      const key = String(value)
      v.values[key] = (v.values[key] ?? 0) + 1
    }
  }
}

const offending = Object.entries(violations).sort((a, b) => b[1].count - a[1].count)
const summary = {
  export: EXPORT,
  featuresChecked: features,
  enumPropertiesValidated: [...allowedByProp.keys()],
  violationProperties: offending.length,
  violations: Object.fromEntries(offending),
}
await mkdir(OUT_DIR, { recursive: true })
await Bun.write(`${OUT_DIR}/validate-export.json`, JSON.stringify(summary, null, 2))

console.log('\n── LUA export vs output schema ──────────────────────────')
console.log(`features checked       ${features}`)
console.log(`enum properties        ${allowedByProp.size}`)
if (offending.length === 0) {
  console.log('✅ all values within the controlled vocabulary')
} else {
  console.log(`⚠️  ${offending.length} properties have out-of-vocabulary values:`)
  for (const [name, v] of offending) {
    const top = Object.entries(v.values).sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log(`  ${name.padEnd(20)} ${v.count}  e.g. ${top.map(([val, n]) => `${val}(${n})`).join(', ')}`)
  }
}
console.log(`\nArtifact: ${OUT_DIR}/validate-export.json`)
