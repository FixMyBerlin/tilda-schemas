/**
 * Parse one line of a line-delimited GeoJSON FeatureCollection (one Feature per line
 * inside the `features` array). Returns the Feature, or null for header/footer/blank
 * lines and unparseable rows.
 *
 * Shared so every consumer uses the SAME robust guard — handles both the pretty-printed
 * source export (`{ "type": "Feature", ... }`) and the compact clipped output
 * (`{"type":"Feature",...}`), and the optional trailing comma.
 */
export interface GeoJsonFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry?: { type: string; coordinates: unknown }
}

export function parseFeatureLine(raw: string): GeoJsonFeature | null {
  const line = raw.trim()
  if (line.length < 2 || line[0] !== '{') return null // header/footer/blank
  const json = line.endsWith(',') ? line.slice(0, -1) : line
  let feature: GeoJsonFeature
  try {
    feature = JSON.parse(json)
  } catch {
    return null
  }
  if (feature?.type !== 'Feature' || !feature.properties) return null
  return feature
}
