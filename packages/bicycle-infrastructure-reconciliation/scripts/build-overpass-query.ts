/**
 * Build the Overpass QL query for the Berlin reference export.
 *
 * Single source of truth: the bbox (berlin-bbox.ts) and the highway list
 * (relevant-highways.ts). Run this to print the query you can paste into
 * https://overpass-turbo.eu — handy if the scripted download fails.
 *
 *   bun scripts/build-overpass-query.ts
 */
import { BERLIN_BBOX_OVERPASS } from './berlin-bbox.ts'
import { RELEVANT_HIGHWAYS } from './relevant-highways.ts'

export function buildOverpassQuery(): string {
  const highways = RELEVANT_HIGHWAYS.join('|')
  const bbox = BERLIN_BBOX_OVERPASS
  // Two clauses:
  //  1. ways whose final `highway` value is one we process.
  //  2. `highway=construction` ways — the LUA pipeline (transform_lifecycle_tags.lua)
  //     resolves `highway=construction` + `construction=<allowed highway>` into a real
  //     highway with `lifecycle=construction`. Without this clause the reference misses
  //     all under-construction infrastructure (~0.2% of Berlin, but it exercises the
  //     lifecycle logic). `proposed`/`disused` are intentionally NOT included — the LUA
  //     pipeline skips them.
  return [
    '[out:json][timeout:300];',
    '(',
    `  way["highway"~"^(${highways})$"](${bbox});`,
    `  way["highway"="construction"](${bbox});`,
    ');',
    'out tags geom;',
  ].join('\n')
}

if (import.meta.main) {
  console.log(buildOverpassQuery())
}
