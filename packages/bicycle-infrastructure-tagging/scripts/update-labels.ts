/**
 * Copies TILDA's German labels for the bike infrastructure dataset from a local tilda-geo checkout
 * into `src/labels/data/tilda-labels.de.json`.
 *
 * Source: the processed topic docs, `app/src/data/generated/topicDocs/inspectorTranslations.gen.ts`
 * (keys like `atlas_bikelanes--category=cycleway_adjoining`).
 *
 * Usage: bun run update-labels [-- <path to tilda-geo or to inspectorTranslations.gen.ts>]
 * The path can also come from the environment variable TILDA_GEO_PATH. Default:
 * ~/Development/FMC/tilda-geo
 */
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PREFIX = 'atlas_bikelanes--'
const SOURCE_FILE = 'app/src/data/generated/topicDocs/inspectorTranslations.gen.ts'

const argument = process.argv[2] ?? process.env.TILDA_GEO_PATH
const given = argument ?? join(homedir(), 'Development/FMC/tilda-geo')
const source = given.endsWith('.ts') ? resolve(given) : join(resolve(given), SOURCE_FILE)
const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/labels/data/tilda-labels.de.json',
)

const { default: data } = (await import(pathToFileURL(source).href)) as {
  default: Record<string, string>
}

const labels = Object.fromEntries(
  Object.entries(data)
    .filter(([key]) => key.startsWith(PREFIX))
    .map(([key, value]) => [key.slice(PREFIX.length), value] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
)

writeFileSync(target, JSON.stringify(labels, null, 2) + '\n')
console.log(`${Object.keys(labels).length} labels from ${source} -> ${target}`)
