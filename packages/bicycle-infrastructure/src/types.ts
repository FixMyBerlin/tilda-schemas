/**
 * Raw OSM tags: a plain string→string map. Tag values are `string | undefined`.
 * Internal transformation fields (underscore-prefixed, mirroring the LUA) carry
 * non-string payloads (`_parent` object, `_length` number); they are typed `any` so they
 * stay compatible with the string index signature without polluting tag-value types.
 */
export interface OsmTags {
  [key: string]: string | undefined
  _side?: 'self' | 'left' | 'right'
  _prefix?: string
  _infix?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _parent?: any
  _parent_highway?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _length?: any
}

export type Side = 'left' | 'right'

/** Sentinel mirroring LUA `SANITIZE_VALUES.disallowed` ('DISALLOWED_VALUE'). */
export const DISALLOWED = 'DISALLOWED_VALUE'

export type ImplicitOneWayConfidence = 'high' | 'medium' | 'low' | 'not_applicable'

export interface BikelaneCategory {
  id: string
  infrastructureExists: boolean
  implicitOneWay: boolean
  implicitOneWayConfidence: ImplicitOneWayConfidence
  copySurfaceSmoothnessFromParent: boolean
  /** Receives a decision-view of the tags; returns truthy when the category matches. */
  condition: (tags: OsmTags) => boolean | undefined
  /** Optional post-match mutation of the tags (mirrors LUA `process`). */
  process?: (tags: OsmTags) => void
}

/** One processed bikelane feature (subset of Tilda's exported properties). */
export interface BikelaneResult {
  _side: 'self' | 'left' | 'right'
  _prefix: string | null
  _infrastructureExists: boolean
  category: string
  oneway?: string
  surface?: string | null
  surface_source?: string | null
  surface_confidence?: string | null
  smoothness?: string | null
  smoothness_source?: string | null
  smoothness_confidence?: string | null
  separation_left?: string | null
  separation_right?: string | null
  buffer_left?: number | null
  buffer_right?: number | null
  marking_left?: string | null
  marking_right?: string | null
  traffic_mode_left?: string | null
  traffic_mode_right?: string | null
  surface_color?: string | null
  traffic_sign?: string | null
  width?: number | null
}
