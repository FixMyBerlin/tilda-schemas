/** Port of topics/helper/derive_surface.lua + bikelanes/helper/derive_bikelane_surface.lua */
import type { BikelaneCategory, OsmTags } from '../types.ts'
import { DISALLOWED } from '../types.ts'
import { sanitizeSurface } from '../sanitize/sanitize-surface.ts'

export interface SurfaceResult {
  surface?: string
  surface_source?: string
  surface_confidence?: string
}

/** derive_surface: direct `surface=*` tag only (disallowed values dropped). */
export function deriveSurface(tags: OsmTags): SurfaceResult {
  if (tags.surface == null) return {}
  const surface = sanitizeSurface(tags)
  if (surface === DISALLOWED) return {}
  return { surface, surface_source: 'tag', surface_confidence: 'high' }
}

/** derive_bikelane_surface: own tag, else parent highway tag when category allows. */
export function deriveBikelaneSurface(tags: OsmTags, category: BikelaneCategory): SurfaceResult {
  const own = deriveSurface(tags)
  if (own.surface != null) {
    return { surface: own.surface, surface_source: 'tag', surface_confidence: 'high' }
  }
  const parent = tags._parent
  if (category.copySurfaceSmoothnessFromParent && parent != null) {
    const parentSurface = deriveSurface(parent)
    if (parentSurface.surface != null) {
      return { surface: parentSurface.surface, surface_source: 'parent_highway_tag', surface_confidence: 'high' }
    }
  }
  return {}
}
