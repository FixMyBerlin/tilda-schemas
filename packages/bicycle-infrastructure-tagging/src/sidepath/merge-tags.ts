import { parseWidth, isUnderConstruction } from '@tilda-geo/bicycle-infrastructure'
import { pathRole } from '../path-role.ts'
import type { OsmTags } from '../types.ts'
import { formatMeters } from '../widths/part-widths.ts'

/**
 * Tag logic for one foot and cycle path made of a bike part and a foot part (WORKDOC features
 * 17 C and 28): either two separate ways that are merged, or the two sides of a road that are
 * extracted together. Pure functions.
 */

/** Tags a traffic sign implies (from the traffic sign converter), see `modules/traffic_sign/sign_tag_plan.ts` */
export type SignRecommend = (trafficSignValue: string) => Record<string, string | string[]>
/** Signs of both parts in one `traffic_sign` value, by the traffic sign tool's rules */
export type JoinSigns = (bike: string, foot: string) => string

export type PartKind = 'bike' | 'foot'

/** Keys that describe one part: equal values merge, others get the `cycleway:` / `footway:` prefix */
const PART_KEYS = ['surface', 'smoothness', 'surface:colour', 'sett:length']
const META_PREFIXES = ['', 'source:', 'note:', 'check_date:']
const SIGN_KEYS = ['traffic_sign', 'traffic_sign:forward', 'traffic_sign:backward']
/** Keys set by the path itself, never copied from a part */
const PATH_KEYS = new Set([
  'highway',
  'construction',
  'bicycle',
  'foot',
  'segregated',
  'oneway',
  'is_sidepath',
])
const MAPILLARY_KEY = /(^|:)mapillary(:|$)/
const TRAFFIC_MODE_SIDE = /^traffic_mode:(left|right|both)$/

/** The values of `cycleway=` / `footway=` / `path=` that make a way a crossing, as TILDA reads them */
const CROSSING_VALUES = new Set(['crossing', 'traffic_island'])
const CROSSING_KEYS = ['cycleway', 'footway', 'path']

/** `crossing` or `traffic_island` of a way's own class key (`cycleway=crossing` on a cycleway) */
function crossingValue(tags: OsmTags): string | undefined {
  const highway = tags.highway === 'construction' ? tags.construction : tags.highway
  const value = highway ? tags[highway] : undefined
  return value !== undefined && CROSSING_VALUES.has(value) ? value : undefined
}

/**
 * The tags of a way under construction: `highway=<class>` becomes `highway=construction` +
 * `construction=<class>`, as for a road under construction. TILDA reads both the same way
 * (`highwayClass`). A way that has no highway or already is under construction stays as it is.
 */
export function withConstruction(tags: OsmTags): OsmTags {
  if (!tags.highway || tags.highway === 'construction') return tags
  return { ...tags, highway: 'construction', construction: tags.highway }
}

/**
 * Which part of a foot and cycle path a way is: a cycleway, a footway, or neither. This is the
 * `part` of `pathRole`: a line that carries only one mode.
 */
export function partKind(tags: OsmTags): PartKind | undefined {
  return pathRole(tags).part
}

const REVERSE_SWAP: Readonly<Record<string, string>> = {
  forward: 'backward',
  backward: 'forward',
  left: 'right',
  right: 'left',
}
/** Keys whose parts after them name a side of the road (`cycleway:right`, `sidewalk:bicycle:left`) */
const ROAD_SIDE_PREFIXES = new Set(['cycleway', 'sidewalk', 'parking'])
const ROAD_SIDES = new Set(['left', 'right', 'both'])
/** Keys whose side is read in the riding direction of a one-way way (Proposal:Separation) */
const RIDING_SIDE_KEYS = new Set(['separation', 'marking', 'buffer', 'traffic_mode'])
const ONE_WAY_VALUES = new Set(['yes', '1', '-1'])

function reverseKey(key: string, oneWay: boolean): string {
  const parts = key.split(':')
  const prefix = parts.findIndex((part) => ROAD_SIDE_PREFIXES.has(part))
  const roadSide =
    prefix === -1 ? -1 : parts.findIndex((part, i) => i > prefix && ROAD_SIDES.has(part))
  return parts
    .map((part, i) => {
      if (part !== 'left' && part !== 'right') return REVERSE_SWAP[part] ?? part
      // on a road side: the side of the road swaps, a second side is read in the lane's riding direction
      if (roadSide !== -1) return i === roadSide ? REVERSE_SWAP[part]! : part
      // on a one-way way of its own: read in the riding direction, which does not change
      if (oneWay && RIDING_SIDE_KEYS.has(parts[i - 1] ?? '')) return part
      return REVERSE_SWAP[part]!
    })
    .join(':')
}

/**
 * Tags of the same way drawn the other way round ("redraw"): nothing changes in the real world.
 * - `forward` / `backward` swap; `oneway` values relative to the line turn (`yes` ↔ `-1`), so the
 *   riding direction stays.
 * - On a road side (`cycleway:<side>…`, `sidewalk:<side>…`, `parking:<side>…`) only the side of the
 *   road swaps (`both` stays). A second side (`cycleway:right:separation:left`,
 *   `cycleway:both:marking:left`) is read in the lane's riding direction (Proposal:Separation,
 *   tilda-geo processing `e9dc145`) and stays, also on a lane in both directions.
 * - On a way of its own, `separation`, `marking`, `buffer` and `traffic_mode` sides are read in the
 *   riding direction when the way is one-way for bicycles (`oneway:bicycle`, else `oneway`, is
 *   `yes` or `-1`): they stay. On a two-way way they refer to the line and swap, as all other sides.
 *
 * See Maid `docs/research/reverse-side-keys.md` for the cases.
 */
export function reverseTags(tags: OsmTags): OsmTags {
  const oneWay = ONE_WAY_VALUES.has(tags['oneway:bicycle'] ?? tags.oneway ?? '')
  const result: OsmTags = {}
  for (const [key, value] of Object.entries(tags)) result[reverseKey(key, oneWay)] = value
  // `oneway` values are relative to the drawing direction; `no` and other values stay
  for (const key of Object.keys(result)) {
    if (key !== 'oneway' && !key.startsWith('oneway:') && !/:oneway(:|$)/.test(key)) continue
    if (result[key] === 'yes' || result[key] === '1') result[key] = '-1'
    else if (result[key] === '-1') result[key] = 'yes'
  }
  return result
}

/** Without the tool's rules: the country prefix once, `;` between the signs of the two parts */
export function joinSignsPlain(bike: string, foot: string) {
  const prefix = /^([A-Z]{2}):/.exec(bike)?.[1]
  return `${bike};${prefix && foot.startsWith(`${prefix}:`) ? foot.slice(prefix.length + 1) : foot}`
}

function safeRecommend(recommend: SignRecommend | undefined, sign: string | undefined) {
  if (!sign || !recommend || sign === 'none') return {}
  try {
    return recommend(sign)
  } catch {
    return {}
  }
}

export type PathTagOptions = {
  recommend?: SignRecommend
  joinSigns?: JoinSigns
  /** Whose value stays when both parts have different values of a key that is not split */
  primary?: PartKind
}

export type PathTags = {
  tags: OsmTags
  /** `key=value` of the other part that lost against the primary part's value */
  dropped: string[]
}

/**
 * The tags of one `highway=path` for a bike part and a foot part. Both are given as the tags of
 * a way of their own (`surface`, `width`, `traffic_sign`, `oneway` of the bike part, …), in the
 * direction of the path.
 */
export function combinedPathTags(
  bike: OsmTags,
  foot: OsmTags,
  options: PathTagOptions = {},
): PathTags {
  const { recommend, primary = 'bike' } = options
  const joinSigns = options.joinSigns ?? joinSignsPlain
  const handled = new Set<string>(PATH_KEYS)
  const dropped: string[] = []

  // signs: both parts in one value
  const signs: OsmTags = {}
  for (const key of SIGN_KEYS) {
    handled.add(key)
    const b = bike[key]
    const f = foot[key]
    const values = [b, f].filter((value): value is string => !!value && value !== 'none')
    if (values.length === 2) signs[key] = b === f ? values[0]! : joinSigns(values[0]!, values[1]!)
    else if (values.length === 1) signs[key] = values[0]!
    else if (b === 'none' || f === 'none') signs[key] = 'none'
  }
  const bikeSign = safeRecommend(recommend, bike.traffic_sign)
  const footSign = safeRecommend(recommend, foot.traffic_sign)
  // the tool's normalized value (`DE:241` → `DE:241-30`) when it is one sign value
  const normalized = bikeSign.traffic_sign ?? footSign.traffic_sign
  if (
    typeof normalized === 'string' &&
    (!bike.traffic_sign || !foot.traffic_sign || bike.traffic_sign === foot.traffic_sign)
  ) {
    signs.traffic_sign = normalized
  }
  const segregated = [bikeSign.segregated, footSign.segregated].find(
    (value) => typeof value === 'string',
  ) as string | undefined

  const tags: OsmTags = {
    highway: 'path',
    bicycle: 'designated',
    foot: 'designated',
    // two parts are segregated unless the sign says shared (240)
    segregated: segregated ?? 'yes',
  }
  const isSidepath = bike.is_sidepath ?? foot.is_sidepath
  if (bike.is_sidepath === 'yes' || foot.is_sidepath === 'yes' || foot.footway === 'sidewalk')
    tags.is_sidepath = 'yes'
  else if (isSidepath) tags.is_sidepath = isSidepath
  if (foot.footway === 'sidewalk') handled.add('footway')
  Object.assign(tags, signs)

  // part keys: one key when equal, prefixed keys otherwise
  for (const key of PART_KEYS) {
    for (const meta of META_PREFIXES) {
      handled.add(meta + key)
      const b = bike[meta + key]
      const f = foot[meta + key]
      if (b !== undefined && b === f) {
        tags[meta + key] = b
      } else {
        if (b !== undefined) tags[`${meta}cycleway:${key}`] = b
        if (f !== undefined) tags[`${meta}footway:${key}`] = f
      }
    }
  }
  // widths never merge: the path's width is the sum
  for (const meta of META_PREFIXES) {
    handled.add(`${meta}width`)
    if (bike[`${meta}width`]) tags[`${meta}cycleway:width`] = bike[`${meta}width`]
    if (foot[`${meta}width`]) tags[`${meta}footway:width`] = foot[`${meta}width`]
  }
  const bikeWidth = parseWidth(bike.width)
  const footWidth = parseWidth(foot.width)
  if (bikeWidth !== undefined && footWidth !== undefined)
    tags.width = formatMeters(bikeWidth + footWidth)

  // everything else: both parts' keys; the primary part wins a conflict
  const [first, second] = primary === 'bike' ? [bike, foot] : [foot, bike]
  const otherPart = { bike: 'foot', foot: 'bicycle' }
  for (const [part, kind] of [
    [first, primary],
    [second, primary === 'bike' ? 'foot' : 'bike'],
  ] as [OsmTags, PartKind][]) {
    for (const [key, value] of Object.entries(part)) {
      if (value === undefined || handled.has(key)) continue
      // "the neighbour is the footway / the cycleway" only said that the two are one space
      if (TRAFFIC_MODE_SIDE.test(key) && value === otherPart[kind]) continue
      if (tags[key] === undefined) {
        tags[key] = value
      } else if (MAPILLARY_KEY.test(key)) {
        const ids = new Set(
          [...tags[key].split(';'), ...value.split(';')].map((id) => id.trim()).filter(Boolean),
        )
        tags[key] = [...ids].join(';')
      } else if (tags[key] !== value) {
        dropped.push(`${key}=${value}`)
      }
    }
  }

  // a part under construction: so is the path
  if (isUnderConstruction(bike) || isUnderConstruction(foot))
    Object.assign(tags, withConstruction(tags))

  // a foot crossing and a bike crossing are one crossing of the path: `path=crossing`, as TILDA
  // reads a crossing on a `highway=path`, not `footway=crossing` and `cycleway=crossing` side by side
  const crossing = crossingValue(bike) ?? crossingValue(foot)
  if (crossing) {
    for (const key of CROSSING_KEYS) if (CROSSING_VALUES.has(tags[key] ?? '')) delete tags[key]
    tags[tags.highway === 'construction' ? tags.construction! : tags.highway!] = crossing
    delete tags.is_sidepath
  }

  tags.oneway = 'no'
  // only where it says something: on a way that is not one-way, `oneway:bicycle=no` is the default
  if (bike.oneway === 'yes' || bike.oneway === '-1') tags['oneway:bicycle'] = bike.oneway

  return { tags, dropped }
}

/** A selected way, as far as the merge needs it */
export type MergeWay = {
  id: string
  tags: OsmTags
  /** changeset of the loaded version; `undefined` for a way created in this session */
  changeset: number | undefined
  lengthMeters: number
}

export type MergeSelection =
  | { disabled: 'mixed' | 'lengths' }
  | { disabled: 'different_values'; key: string }
  /** one part is under construction, the other is not: map them as two lines instead */
  | { disabled: 'different_lifecycle' }
  | {
      disabled: false
      surviving: PartKind
      survivors: MergeWay[]
      deleted: MergeWay[]
      /** the lengths differ too much: the way of this kind (the longer one) is cut to the other's length first */
      cut?: PartKind
    }

export type MergeConfig = {
  /** Lengths may differ by this many meters, or by `lengthToleranceShare` of the longer one */
  lengthToleranceMeters: number
  lengthToleranceShare: number
}

export const DEFAULT_MERGE_CONFIG: MergeConfig = {
  lengthToleranceMeters: 15,
  lengthToleranceShare: 0.2,
}

/**
 * What a selection of ways merges into: `undefined` when it is not cycleways plus footways.
 * - One way of one kind and one or more of the other; several of both is too complex.
 * - The older kind keeps its geometry: a saved way beats a new one, then the older changeset.
 * - Lengths that differ too much: with two ways the longer one is cut to the other's length (`cut`);
 *   with more ways there is no clear place to cut, so the mapper splits first.
 */
export function mergeSelection(
  ways: MergeWay[],
  config: Partial<MergeConfig> = {},
): MergeSelection | undefined {
  const { lengthToleranceMeters, lengthToleranceShare } = { ...DEFAULT_MERGE_CONFIG, ...config }
  if (ways.length < 2) return undefined
  const kinds = ways.map((way) => partKind(way.tags))
  if (kinds.some((kind) => kind === undefined)) return undefined
  const bikes = ways.filter((_way, index) => kinds[index] === 'bike')
  const foots = ways.filter((_way, index) => kinds[index] === 'foot')
  if (!bikes.length || !foots.length) return undefined
  if (bikes.length > 1 && foots.length > 1) return { disabled: 'mixed' }
  if (new Set(ways.map((way) => isUnderConstruction(way.tags))).size > 1)
    return { disabled: 'different_lifecycle' }

  const length = (list: MergeWay[]) => list.reduce((sum, way) => sum + way.lengthMeters, 0)
  const difference = Math.abs(length(bikes) - length(foots))
  const longer = Math.max(length(bikes), length(foots))
  const lengthsDiffer = difference > Math.max(lengthToleranceMeters, longer * lengthToleranceShare)
  if (lengthsDiffer && ways.length > 2) return { disabled: 'lengths' }
  const cut: PartKind | undefined = !lengthsDiffer
    ? undefined
    : length(bikes) > length(foots)
      ? 'bike'
      : 'foot'

  const age = (list: MergeWay[]) => Math.min(...list.map((way) => way.changeset ?? Infinity))
  // equally old (e.g. both new): the footway, it usually has the junctions
  const surviving: PartKind = age(bikes) < age(foots) ? 'bike' : 'foot'
  const [survivors, deleted] = surviving === 'bike' ? [bikes, foots] : [foots, bikes]

  // one surviving way can carry one value per part
  if (survivors.length === 1 && deleted.length > 1) {
    for (const key of [...PART_KEYS, 'width']) {
      if (new Set(deleted.map((way) => way.tags[key])).size > 1)
        return { disabled: 'different_values', key }
    }
  }
  return cut
    ? { disabled: false, surviving, survivors, deleted, cut }
    : { disabled: false, surviving, survivors, deleted }
}

/** The tags several pieces of one kind share; of differing values the first piece's stays */
export function commonTags(pieces: OsmTags[]): OsmTags {
  const result: OsmTags = {}
  for (const tags of pieces) {
    for (const [key, value] of Object.entries(tags)) {
      if (result[key] === undefined) result[key] = value
    }
  }
  return result
}
