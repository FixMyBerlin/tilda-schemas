/**
 * Port of roads_bikelanes/bikelanes/helper/derive_bikelane_surface_tags.lua (tilda-geo 7acec52af),
 * without the hint tokens: the package does not output `description`.
 *
 * `surface:bicycle*`, `surface:forward|backward`, `surface:left|right` and `smoothness:bicycle`
 * on bikelanes. One bikelane line cannot show a strip or one half of a way, so one surface is picked.
 * The category decides how a bikelane reads the tags (`BikelaneCategory.bicycleSurface`):
 *
 * - `strip` (bicycleRoad, bicycleRoad_vehicleDestination, pedestrianAreaBicycleYes,
 *   sharedMotorVehicleLane) and `whole_way` (cycleway_*, footAndCycleway*, footwayBicycleYes_*)
 *   both take `surface:bicycle` first; they differ only in the hints, which are not ported.
 * - Without `surface:bicycle` and `surface`, the worst directional or side value is the surface.
 * - undefined (lanes on the road, bus lanes): their own surface is `cycleway:<side>:surface`; the road's
 *   values are only the fallback (`copySurfaceSmoothnessFromParent`), in this order: `surface:bicycle`,
 *   `surface:bicycle:<side>`, `surface:bicycle:forward|backward`, `surface:<side>`,
 *   `surface:forward|backward`, `surface`, then the worst directional or side value. The lane lies in
 *   one half of the road: right = forward, left = backward; the direction values only count on
 *   roads without `oneway=yes|-1`.
 *
 * When the surface comes from `surface:bicycle`, or a lane takes the side or direction value of the
 * road, the way's `smoothness` does not apply to it; the smoothness is then derived from that surface
 * (unless `smoothness:bicycle` is given). When the worst directional value of the way itself is used,
 * the way's `smoothness` still applies, as on roads.
 */
import { allowedSurface } from '../sanitize/sanitize-surface.ts'
import type { BikelaneCategory, OsmTags } from '../types.ts'
import { worstDirectionalSurface } from './derive-directional-surface.ts'

interface SurfaceChoice {
  /** raw OSM value */
  surface: string | undefined
  /** raw OSM value */
  smoothness: string | undefined
  directional: boolean
}

export interface BikelaneSurfaceTags {
  /** Tags to derive the bikelane surface and smoothness from */
  tags: OsmTags
  /** The surface came from a directional or side value of the bikelane itself */
  directional: boolean
  /** The surface of the parent road came from a directional or side value */
  parentDirectional: boolean
}

function choose(tags: OsmTags): SurfaceChoice {
  const bicycle = allowedSurface(tags['surface:bicycle'], tags)
    ? tags['surface:bicycle']
    : undefined
  const bicycleSmoothness = tags['smoothness:bicycle']
  if (bicycle) {
    return { surface: bicycle, smoothness: bicycleSmoothness, directional: false }
  }
  if (allowedSurface(tags.surface, tags)) {
    return {
      surface: tags.surface,
      smoothness: bicycleSmoothness ?? tags.smoothness,
      directional: false,
    }
  }
  const fallback = worstDirectionalSurface(tags)
  if (fallback) {
    return {
      surface: fallback,
      smoothness: bicycleSmoothness ?? tags.smoothness,
      directional: true,
    }
  }
  return {
    surface: undefined,
    smoothness: bicycleSmoothness ?? tags.smoothness,
    directional: false,
  }
}

const SIDE_TO_DIRECTION = { right: 'forward', left: 'backward' } as const

function chooseForSide(parent: OsmTags, side: 'left' | 'right'): SurfaceChoice {
  if (allowedSurface(parent['surface:bicycle'], parent)) return choose(parent)
  const twoWay = parent.oneway !== 'yes' && parent.oneway !== '-1'
  const direction = SIDE_TO_DIRECTION[side]
  const allowed = (key: string) => (allowedSurface(parent[key], parent) ? parent[key] : undefined)

  const surface =
    allowed(`surface:bicycle:${side}`) ??
    (twoWay ? allowed(`surface:bicycle:${direction}`) : undefined) ??
    allowed(`surface:${side}`) ??
    (twoWay ? allowed(`surface:${direction}`) : undefined)
  if (surface) {
    return { surface, smoothness: parent['smoothness:bicycle'], directional: true }
  }
  return choose(parent)
}

/** Copy of the tags with the chosen `surface` and `smoothness`. */
function override(tags: OsmTags, choice: SurfaceChoice, parent?: OsmTags): OsmTags {
  const result: OsmTags = { ...tags }
  result.surface = choice.surface
  result.smoothness = choice.smoothness
  result._parent = parent
  return result
}

/** Tags to derive the bikelane surface and smoothness from, see the definition above. */
export function deriveBikelaneSurfaceTags(
  tags: OsmTags,
  category: BikelaneCategory,
): BikelaneSurfaceTags {
  let parent: OsmTags | undefined
  let parentDirectional = false
  if (
    category.copySurfaceSmoothnessFromParent &&
    typeof tags._parent === 'object' &&
    tags._parent
  ) {
    const side = tags._side
    const parentChoice =
      side === 'left' || side === 'right' ? chooseForSide(tags._parent, side) : choose(tags._parent)
    parent = override(tags._parent, parentChoice)
    parentDirectional = parentChoice.directional
  }

  if (category.bicycleSurface == null) {
    if (parent == null) return { tags, directional: false, parentDirectional: false }
    return {
      tags: override(
        tags,
        { surface: tags.surface, smoothness: tags.smoothness, directional: false },
        parent,
      ),
      directional: false,
      parentDirectional,
    }
  }
  const choice = choose(tags)
  return {
    tags: override(tags, choice, parent),
    directional: choice.directional,
    parentDirectional,
  }
}

/** `surface_source` with the `_directional` suffix when the surface came from a directional or side value. */
export function bikelaneSurfaceSource(
  surfaceTags: BikelaneSurfaceTags,
  surfaceSource: string | undefined,
): string | undefined {
  if (surfaceSource === 'tag' && surfaceTags.directional) return 'tag_directional'
  if (surfaceSource === 'parent_highway_tag' && surfaceTags.parentDirectional) {
    return 'parent_highway_tag_directional'
  }
  return surfaceSource
}
