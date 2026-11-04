/**
 * Clip the full Tilda "bikelanes" LUA GeoJSON export down to the Berlin bbox.
 *
 * The full export (Berlin+Brandenburg, ~162MB, EPSG:3857) has one Feature per line
 * inside the `features` array, so we can stream line-by-line without loading it all.
 *
 * A feature is kept when its geometry bounding box intersects the Berlin bbox.
 * CRS is preserved as-is (EPSG:3857) so the file stays a faithful copy of Tilda output.
 *
 * Usage:
 *   bun scripts/clip-tilda-export.ts <input.geojson> <output.geojson>
 */
import { createReadStream, createWriteStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { parseFeatureLine } from '../src/geojson-feature-line.ts'
import { BERLIN_BBOX_3857 as BB } from './berlin-bbox.ts'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  console.error('Usage: bun scripts/clip-tilda-export.ts <input.geojson> <output.geojson>')
  process.exit(1)
}

/** Recursively find the min/max X/Y of any nested coordinate array. */
function geomBBox(
  coords: any,
  acc = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
) {
  if (typeof coords[0] === 'number') {
    const [x, y] = coords as [number, number]
    if (x < acc.minX) acc.minX = x
    if (y < acc.minY) acc.minY = y
    if (x > acc.maxX) acc.maxX = x
    if (y > acc.maxY) acc.maxY = y
    return acc
  }
  for (const c of coords) geomBBox(c, acc)
  return acc
}

const bboxIntersects = (a: { minX: number; minY: number; maxX: number; maxY: number }) =>
  a.minX <= BB.maxX && a.maxX >= BB.minX && a.minY <= BB.maxY && a.maxY >= BB.minY

const rl = createInterface({ input: createReadStream(inputPath, 'utf8'), crlfDelay: Infinity })
const out = createWriteStream(outputPath, 'utf8')

out.write('{\n"type": "FeatureCollection",\n"name": "tilda-bikelanes-berlin",\n')
out.write('"crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::3857" } },\n')
out.write('"features": [\n')

let total = 0
let kept = 0
let wroteOne = false

for await (const raw of rl) {
  const feature = parseFeatureLine(raw)
  if (!feature) continue
  total++

  const coords = feature.geometry?.coordinates
  if (!coords) continue
  if (!bboxIntersects(geomBBox(coords))) continue

  if (wroteOne) out.write(',\n')
  out.write(JSON.stringify(feature))
  wroteOne = true
  kept++
}

out.write('\n]\n}\n')
out.end()

await new Promise((resolve) => out.on('finish', resolve))
console.log(`Done. Scanned ${total} features, kept ${kept} within Berlin bbox.`)
console.log(`Wrote: ${outputPath}`)
