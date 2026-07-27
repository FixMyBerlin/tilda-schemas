/**
 * Shared Berlin reference bounding box.
 *
 * One single definition reused by every reference-data step (clip + Overpass),
 * so the Tilda LUA export and the Overpass raw export cover the exact same area.
 *
 * Source: commonly used Berlin administrative bounding box (WGS84 / EPSG:4326).
 */
export const BERLIN_BBOX_WGS84 = {
  west: 13.0883, // minLon
  south: 52.3383, // minLat
  east: 13.7612, // maxLon
  north: 52.6755, // maxLat
} as const

/** Overpass expects `(south,west,north,east)`. */
export const BERLIN_BBOX_OVERPASS =
  `${BERLIN_BBOX_WGS84.south},${BERLIN_BBOX_WGS84.west},${BERLIN_BBOX_WGS84.north},${BERLIN_BBOX_WGS84.east}` as const

// --- Web Mercator (EPSG:3857) projection, to match the Tilda LUA export CRS ---
const R = 6378137
const lon2x = (lon: number) => (R * lon * Math.PI) / 180
const lat2y = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

export const BERLIN_BBOX_3857 = {
  minX: lon2x(BERLIN_BBOX_WGS84.west),
  minY: lat2y(BERLIN_BBOX_WGS84.south),
  maxX: lon2x(BERLIN_BBOX_WGS84.east),
  maxY: lat2y(BERLIN_BBOX_WGS84.north),
} as const
