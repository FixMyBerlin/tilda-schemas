/**
 * Parse a Tilda bikelane feature `id` into its parts.
 *
 * Tilda emits 1..N features per OSM way; the side is encoded in the id suffix:
 *   way/<id>                     -> the way itself (self)
 *   way/<id>/cycleway/left|right -> a `cycleway:left|right=*` split into a side geometry
 *   way/<id>/sidewalk/left|right -> a `sidewalk:*` split into a side geometry
 */
export type TildaSide = 'self' | 'left' | 'right'

export interface ParsedTildaId {
  /** Full id, e.g. `way/123/cycleway/left`. */
  key: string
  /** Numeric OSM way id, e.g. `123`. */
  baseId: number
  /** `way/<id>` — the raw OSM way this feature derives from. */
  baseRef: string
  /** Transformation prefix, e.g. `cycleway` / `sidewalk`, or `null` for the way itself. */
  prefix: string | null
  side: TildaSide
}

export function parseTildaId(id: string): ParsedTildaId {
  const parts = id.split('/')
  const baseId = Number(parts[1])
  const baseRef = `${parts[0]}/${parts[1]}`
  if (parts.length >= 4) {
    return { key: id, baseId, baseRef, prefix: parts[2], side: parts[3] as TildaSide }
  }
  return { key: id, baseId, baseRef, prefix: null, side: 'self' }
}
