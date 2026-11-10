import type { OsmTags, ResultSide } from './types.ts'

/**
 * How foot and bicycle traffic is mapped, one definition for every module that needs it
 * (required attributes, part widths, extracting and merging paths):
 * - `centerline`: on the sides of the road (`cycleway:right=track`, `sidewalk:right:bicycle=yes`);
 *   the widths are `cycleway:right:width`.
 * - `oneLine`: one way for both modes (`highway=path|footway|cycleway` with foot and bicycle
 *   allowed), `segregated=yes|no`. Part widths (`cycleway:width`, `footway:width`) only exist with
 *   `segregated=yes`; with `segregated=no` there is only `width`.
 * - `twoLines`: a line for one mode, so the other mode has a line of its own: a
 *   `highway=cycleway` without foot access (usually `traffic_mode:right=foot` on it) or a
 *   `highway=footway` without bicycle access. No part widths, `width` is the width of this line.
 *   The other mode may be allowed without being designated: a sidewalk with "Radfahrer frei"
 *   (`highway=footway` + `bicycle=yes`, TILDA `footwayBicycleYes`) is the foot line.
 */
export type PathMappingStyle = 'centerline' | 'oneLine' | 'twoLines'

export interface PathRole {
  /** `undefined`: not a way or road side for walking or cycling */
  style: PathMappingStyle | undefined
  carriesFoot: boolean
  carriesBike: boolean
  /**
   * `segregated=yes|no` as tagged. When it is missing, the category decides if given
   * (`footAndCyclewaySegregated*` → `true`, `footAndCyclewayShared*` → `false`), else `undefined`.
   */
  segregated: boolean | undefined
  /** `twoLines` only: which mode this line carries */
  part: 'bike' | 'foot' | undefined
}

export interface PathRoleOptions {
  /** `_side` of the result; a road side is mapped on the centerline. Default `self`. */
  side?: ResultSide
  /** The TILDA category (current or chosen target): decides `segregated` when it is not tagged. */
  category?: string
}

/** Access values that let a mode use the way. */
const ALLOWED = new Set(['designated', 'yes', 'permissive'])

const allowed = (value: string | undefined) => value !== undefined && ALLOWED.has(value)

function segregatedFromTags(value: string | undefined, category: string | undefined) {
  if (value === 'yes') return true
  if (value === 'no') return false
  if (category?.startsWith('footAndCyclewaySegregated')) return true
  if (category?.startsWith('footAndCyclewayShared')) return false
  return undefined
}

function roleOfSide(tags: OsmTags, side: 'left' | 'right', category: string | undefined): PathRole {
  const bike = tags[`cycleway:${side}`] ?? tags['cycleway:both'] ?? tags.cycleway
  const sidewalk = tags[`sidewalk:${side}`] ?? tags['sidewalk:both'] ?? tags.sidewalk
  const sidewalkBike = tags[`sidewalk:${side}:bicycle`] ?? tags['sidewalk:both:bicycle']
  const segregated = tags[`cycleway:${side}:segregated`] ?? tags['cycleway:both:segregated']
  const carriesBike =
    (bike !== undefined && bike !== 'no' && bike !== 'none' && bike !== 'separate') ||
    allowed(sidewalkBike)
  const carriesFoot = sidewalk === 'yes' || sidewalk === 'both' || sidewalk === side
  return {
    style: carriesBike || carriesFoot ? 'centerline' : undefined,
    carriesFoot,
    carriesBike,
    segregated: segregatedFromTags(segregated, category),
    part: undefined,
  }
}

/**
 * What a way (or road side) is for foot and bicycle traffic. Replaces the three definitions of
 * "foot and cycle path" the iD fork had (one per mapping style).
 *
 * On a way, a mode counts when it is `designated`, `yes` or `permissive`. `highway=cycleway`
 * always carries bicycles, `highway=footway` always pedestrians; a `highway=path` carries only
 * what is tagged, because its access depends on the country. A path without any access tag still
 * counts for a mode that is not tagged when the category says the path is for both (`footAndCycleway*`).
 */
export function pathRole(tags: OsmTags, options: PathRoleOptions = {}): PathRole {
  const { side = 'self', category } = options
  if (side === 'left' || side === 'right') return roleOfSide(tags, side, category)

  const none: PathRole = {
    style: undefined,
    carriesFoot: false,
    carriesBike: false,
    segregated: segregatedFromTags(tags.segregated, category),
    part: undefined,
  }
  if (tags.area === 'yes') return none

  let carriesFoot: boolean
  let carriesBike: boolean
  switch (tags.highway) {
    case 'cycleway':
      carriesBike = true
      carriesFoot = allowed(tags.foot)
      break
    case 'footway':
      carriesFoot = true
      carriesBike = allowed(tags.bicycle)
      break
    case 'path':
      carriesFoot = allowed(tags.foot)
      carriesBike = allowed(tags.bicycle)
      // The category says the path is for both: an untagged mode counts unless it is excluded
      if (category?.startsWith('footAndCycleway')) {
        carriesFoot ||= tags.foot === undefined
        carriesBike ||= tags.bicycle === undefined
      }
      break
    default:
      return none
  }

  if (!carriesFoot && !carriesBike) return none
  // A sidewalk where bicycles are only allowed ("Radfahrer frei", TILDA `footwayBicycleYes`):
  // the foot line, not one line for both
  const footDesignated = tags.highway === 'footway' || tags.foot === 'designated'
  const bikeOnlyAllowed = tags.bicycle === 'yes' || tags.bicycle === 'permissive'
  if (carriesFoot && carriesBike && footDesignated && bikeOnlyAllowed) {
    return { ...none, style: 'twoLines', carriesFoot, carriesBike, part: 'foot' }
  }
  if (carriesFoot && carriesBike) return { ...none, style: 'oneLine', carriesFoot, carriesBike }
  return {
    ...none,
    style: 'twoLines',
    carriesFoot,
    carriesBike,
    part: carriesBike ? 'bike' : 'foot',
  }
}
