import { SIDEPATH_HIGHWAY_CLASSES } from '../helpers/highway-classes.ts'
/** Port of topics/roads_bikelanes/bikelanes/transformations.lua */
import type { OsmTags } from '../types.ts'

export interface CenterLineTransformation {
  highway: string
  prefix: string
  direction_reference: 'self' | 'parent'
  filter: (tags: OsmTags) => boolean
}

const SIDES = ['left', 'right'] as const
const META_PREFIXES = ['source:', 'note:'] as const

/**
 * Unnest `<metaPrefix><prefix><infix>...` tags into `dest`. Mirrors the LUA byte-for-byte:
 *   Main key  `cycleway:both`        -> dest.cycleway
 *   Sub-key   `cycleway:left:width`  -> dest.width   (skipped when infix='' and the
 *                                                     first suffix segment is a side)
 *   Meta key  `source:cycleway:left:width` -> dest['source:width']
 */
function unnestPrefixedTags(
  tags: OsmTags,
  prefix: string,
  infix: string,
  dest: OsmTags,
  metaPrefix?: string,
): OsmTags {
  const metaPrefixString = metaPrefix ?? ''
  const fullPrefix = metaPrefixString + prefix + infix
  const prefixLen = fullPrefix.length

  for (const key of Object.keys(tags)) {
    const val = tags[key]
    if (val === undefined) continue
    if (!key.startsWith(fullPrefix)) continue

    if (key === fullPrefix) {
      // Main key
      const destinationKey = metaPrefix ? metaPrefixString.slice(0, -1) : prefix
      dest[destinationKey] = val
      dest._infix = infix
    } else {
      // Sub-key: the part after the separator char following fullPrefix
      const extractedSuffix = key.slice(prefixLen + 1)
      const suffixKey = extractedSuffix.match(/^[^:]*/)![0]
      if (
        infix !== '' ||
        !(suffixKey === 'left' || suffixKey === 'right' || suffixKey === 'both')
      ) {
        const destinationKey = metaPrefix ? metaPrefixString + extractedSuffix : extractedSuffix
        dest[destinationKey] = val
        dest._infix = infix
      }
    }
  }
  return dest
}

const DIRECTED_PARENT_TAGS = ['cycleway:lanes', 'bicycle:lanes']
const DIRECTED_SELF_TAGS = ['traffic_sign']
const SIDE_TO_DIRECTION: Record<string, string> = {
  '': '',
  both: '',
  left: ':backward',
  right: ':forward',
}

function convertDirectedTags(cycleway: OsmTags, directionReference: 'self' | 'parent'): OsmTags {
  const parent = cycleway._parent!
  const side = cycleway._side ?? ''
  for (const key of DIRECTED_PARENT_TAGS) {
    const directedKey = key + SIDE_TO_DIRECTION[side]
    cycleway[key] = cycleway[key] ?? parent[key] ?? parent[directedKey]
  }
  for (const key of DIRECTED_SELF_TAGS) {
    if (directionReference === 'self') {
      cycleway[key] = cycleway[key] ?? cycleway[`${key}:forward`]
    } else {
      const directedKey = key + SIDE_TO_DIRECTION[side]
      cycleway[key] = cycleway[key] ?? cycleway[directedKey]
    }
  }
  return cycleway
}

/** Returns transformed objects in order: [self, left, right, ...]. */
export function getTransformedObjects(
  tags: OsmTags,
  transformations: CenterLineTransformation[],
): OsmTags[] {
  const center: OsmTags = { ...tags, _side: 'self' }

  // Don't split path-like ways; only unnest `cycleway`-prefixed tags onto the self object.
  if (tags.highway != null && SIDEPATH_HIGHWAY_CLASSES.has(tags.highway)) {
    unnestPrefixedTags(tags, 'cycleway', '', center)
    for (const mp of META_PREFIXES) unnestPrefixedTags(tags, 'cycleway', '', center, mp)
    if (center.oneway === 'yes' && tags['oneway:bicycle'] !== 'no') {
      center.traffic_sign = center.traffic_sign ?? center['traffic_sign:forward']
    }
    // `oneway=-1` flows against the way, so its sign is the `:backward` one
    // (follows tilda-geo-private#34, not merged yet).
    if (center.oneway === '-1' && tags['oneway:bicycle'] !== 'no') {
      center.traffic_sign = center.traffic_sign ?? center['traffic_sign:backward']
    }
    return [center]
  }

  const results: OsmTags[] = [center]
  for (const transformation of transformations) {
    for (const side of SIDES) {
      if (tags.highway === transformation.highway) continue
      const prefix = transformation.prefix
      const newObj: OsmTags = {
        _prefix: prefix,
        _side: side,
        _parent_highway: tags.highway,
        highway: transformation.highway,
      }
      newObj._parent = tags

      // Specificity: prefix < prefix:both < prefix:side (later overwrites earlier)
      unnestPrefixedTags(tags, prefix, '', newObj)
      unnestPrefixedTags(tags, prefix, ':both', newObj)
      unnestPrefixedTags(tags, prefix, `:${side}`, newObj)
      for (const mp of META_PREFIXES) {
        unnestPrefixedTags(tags, prefix, '', newObj, mp)
        unnestPrefixedTags(tags, prefix, ':both', newObj, mp)
        unnestPrefixedTags(tags, prefix, `:${side}`, newObj, mp)
      }

      // Only keep if we actually projected something
      if (newObj._infix !== undefined && transformation.filter(newObj)) {
        convertDirectedTags(newObj, transformation.direction_reference)
        results.push(newObj)
      }
    }
  }
  return results
}

/** The transformations used by the bikelanes pipeline (cycleway + sidewalk). */
export const BIKELANE_TRANSFORMATIONS: CenterLineTransformation[] = [
  { highway: 'cycleway', prefix: 'cycleway', direction_reference: 'self', filter: () => true },
  {
    highway: 'footway',
    prefix: 'sidewalk',
    direction_reference: 'parent',
    filter: (t) => !(t.footway === 'no' || t.footway === 'separate'),
  },
]
