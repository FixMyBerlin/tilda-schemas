/**
 * Copies TILDA's German labels for the bike infrastructure dataset from a local tilda-geo checkout
 * into `src/labels/data/tilda-labels.de.json`.
 *
 * Source: the processed topic docs, `app/src/data/generated/topicDocs/inspectorTranslations.gen.ts`
 * (keys like `atlas_bikelanes--category=cycleway_adjoining`).
 *
 * The base categories that `unlocksCategory` of the gap discriminators names without a suffix
 * (`footAndCyclewaySegregated`, `cycleway`, ...) have no key there. Their label is the name of the
 * legend "Führungsform details" in `app/src/components/regionen/pageRegionSlug/mapData/mapDataSubcategories/subcat_bikelanes.const.ts`;
 * they are written as `category=<id>`.
 *
 * Usage: bun run update-labels [-- <path to tilda-geo or to inspectorTranslations.gen.ts>]
 * The path can also come from the environment variable TILDA_GEO_PATH. Default:
 * ~/Development/FMC/tilda-geo
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PREFIX = 'atlas_bikelanes--'
const LEGEND_FILE =
  'app/src/components/regionen/pageRegionSlug/mapData/mapDataSubcategories/subcat_bikelanes.const.ts'
/** Categories without a suffix that `unlocksCategory` of a gap names (`categorySpecs`) */
const BASE_CATEGORY_IDS = [
  'cycleway',
  'footAndCyclewayShared',
  'footAndCyclewaySegregated',
  'footwayBicycleYes',
]
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

/** `{ id: '…', name: '…' }` pairs of the legend, by id */
function legendNames(file: string): Record<string, string> {
  const code = readFileSync(file, 'utf8')
  const pairs = [...code.matchAll(/id: '([A-Za-z_]+)',\s*name: '([^']+)'/g)]
  return Object.fromEntries(pairs.map(([, id, name]) => [id!, name!.trim()]))
}

const root = source.slice(0, source.indexOf('/app/src/'))
const legend = legendNames(join(root, LEGEND_FILE))
const baseLabels = Object.fromEntries(
  BASE_CATEGORY_IDS.map((id) => {
    const name = legend[id]
    if (!name) throw new Error(`No legend name for ${id} in ${LEGEND_FILE}`)
    return [`category=${id}`, name] as const
  }),
)

const labels = Object.fromEntries(
  [
    ...Object.entries(data)
      .filter(([key]) => key.startsWith(PREFIX))
      .map(([key, value]) => [key.slice(PREFIX.length), value] as const),
    ...Object.entries(baseLabels),
  ].sort(([a], [b]) => a.localeCompare(b)),
)

writeFileSync(target, JSON.stringify(labels, null, 2) + '\n')
console.log(`${Object.keys(labels).length} labels from ${source} -> ${target}`)
