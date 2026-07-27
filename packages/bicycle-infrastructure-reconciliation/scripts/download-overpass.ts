/**
 * Download the Berlin reference export from Overpass — ONCE.
 *
 * We deliberately fetch WITH geometry (`out tags geom;`) so this single download is a
 * maximally faithful, reusable static reference (tags + geometry + osm id per way).
 *
 * Guard: refuses to overwrite an existing non-trivial file, so re-running can never
 * trigger a second Overpass download by accident. Delete the file to force a refresh.
 *
 *   bun scripts/download-overpass.ts
 */
import { existsSync, statSync } from 'node:fs'
import { buildOverpassQuery } from './build-overpass-query.ts'

const OUT = 'reference/overpass-berlin-raw.json'
const ENDPOINT = 'https://overpass-api.de/api/interpreter'

if (existsSync(OUT) && statSync(OUT).size > 1024) {
  console.error(`Refusing to re-download: ${OUT} already exists (${statSync(OUT).size} bytes).`)
  console.error('Delete it manually if you really want a fresh Overpass download.')
  process.exit(0)
}

const query = buildOverpassQuery()
console.log('Querying Overpass (this can take a few minutes)...')
const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    // overpass-api.de returns 406 for requests without a proper User-Agent.
    'User-Agent': 'tilda-geo-lua-check/1.0 (https://github.com/FixMyBerlin; tobias@fixmycity.de)',
  },
  body: 'data=' + encodeURIComponent(query),
})

if (!res.ok) {
  console.error('Overpass HTTP', res.status, res.statusText)
  console.error((await res.text()).slice(0, 2000))
  process.exit(1)
}

await Bun.write(OUT, res)
console.log(`Wrote ${OUT} (${statSync(OUT).size} bytes).`)
