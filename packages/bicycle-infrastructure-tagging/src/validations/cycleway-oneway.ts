import { sideOnewayDefault } from '../oneway.ts'
import type { OsmTags, Side } from '../types.ts'

/**
 * `cycleway:<side>:oneway` on a road. `oneway` refers to the direction of the way, so the usual
 * direction on the left side of a two-way road is `-1`, not `yes`; and the defaults are enough:
 * bicycles ride with the traffic on their side
 * (https://wiki.openstreetmap.org/wiki/Key:cycleway:right:oneway#Implicit_values).
 * Two rules, so each can be switched off on its own:
 * - `cycleway_oneway_wrong`: the tag most likely says the wrong direction
 * - `cycleway_oneway_redundant`: the tag repeats the default of a lane on the road. A track may
 *   keep it: there it also says "not in both directions", which the processing would assume
 *   without a tag (tracks are `assumed_no`).
 */

export type CyclewayOnewayRuleId = 'cycleway_oneway_wrong' | 'cycleway_oneway_redundant'

export type CyclewayOnewayFinding = {
  /** id of the rule that found it */
  rule: CyclewayOnewayRuleId
  key: string
  value: string
  kind: 'wrong' | 'redundant'
  /**
   * code of the explanation; the app has the texts
   * - `two_way_road`: `yes` on the left of a two-way road (the tilda-geo todo `unexpected_oneway_direction`)
   * - `contraflow`: the direction of the one-way on the side that is usually the contraflow lane
   * - `reverse_road`: `yes` on a road with `oneway=-1`, against the traffic of the side
   * - `default`: the tag repeats the default
   */
  reason: 'two_way_road' | 'contraflow' | 'reverse_road' | 'default'
  /** the side of the contraflow lane, for `contraflow` */
  side?: Side
}

const ONEWAY_KEYS: Record<string, Side[]> = {
  'cycleway:left:oneway': ['left'],
  'cycleway:right:oneway': ['right'],
  'cycleway:both:oneway': ['left', 'right'],
  'cycleway:oneway': ['left', 'right'],
}

/** The keys `cyclewayOnewayFindings` looks at, to decide if a way needs checking at all */
export const CYCLEWAY_ONEWAY_KEYS = Object.keys(ONEWAY_KEYS)

const TRACK_VALUES = new Set(['track', 'opposite_track'])

/** The direction of traffic on a one-way road (`yes`, `-1`), `undefined` on other roads */
export function roadDirection(tags: OsmTags): 'yes' | '-1' | undefined {
  const oneway = tags.oneway
  if (oneway === '-1') return '-1'
  if (oneway === 'yes' || oneway === '1' || oneway === 'true') return 'yes'
  if (oneway === undefined && (tags.junction === 'roundabout' || tags.junction === 'circular'))
    return 'yes'
  return undefined
}

/**
 * A one-way road that bicycles may ride against (`oneway:bicycle=no`): the side of the usual
 * contraflow lane and its value. In right-hand traffic the motor vehicles drive on the right of
 * their direction, so the contraflow lane is on the left of `oneway=yes` (`-1`) and on the right
 * of a road drawn against its direction, `oneway=-1` (`yes`).
 */
export function contraflowSide(tags: OsmTags): { side: Side; value: 'yes' | '-1' } | undefined {
  if (tags['oneway:bicycle'] !== 'no') return undefined
  const direction = roadDirection(tags)
  if (direction === 'yes') return { side: 'left', value: '-1' }
  if (direction === '-1') return { side: 'right', value: 'yes' }
  return undefined
}

/** The cycleway value of one side (`cycleway:<side>` → `cycleway:both` → `cycleway`) */
function cyclewayValue(tags: OsmTags, side: Side) {
  return tags[`cycleway:${side}`] ?? tags['cycleway:both'] ?? tags.cycleway
}

/** The tagged infrastructure on all these sides is a track */
function onlyTracks(tags: OsmTags, sides: Side[]) {
  const values = sides.map((side) => cyclewayValue(tags, side)).filter((v) => v !== undefined)
  return values.length > 0 && values.every((value) => TRACK_VALUES.has(value))
}

/** The `cycleway:*:oneway` tags of a road that are likely wrong or not needed */
export function cyclewayOnewayFindings(tags: OsmTags): CyclewayOnewayFinding[] {
  if (!tags.highway) return []

  const direction = roadDirection(tags)
  const contraflow = contraflowSide(tags)
  const findings: CyclewayOnewayFinding[] = []

  for (const [key, keySides] of Object.entries(ONEWAY_KEYS)) {
    const value = tags[key]
    if (value !== 'yes' && value !== '-1') continue
    // a side with its own key is not covered by `:both:` or the key without a side
    const sides = keySides.filter(
      (side) => keySides.length === 1 || tags[`cycleway:${side}:oneway`] === undefined,
    )
    if (!sides.length) continue
    const base = { key, value }

    // A one-way road that bicycles may ride against: the processing reads the direction of the
    // one-way on the contraflow side (wiki default), but there that side is usually the contraflow
    // lane. A heuristic for the Radnetz check, not the processing rule.
    if (contraflow && value === direction && sides.includes(contraflow.side)) {
      findings.push({
        ...base,
        rule: 'cycleway_oneway_wrong',
        kind: 'wrong',
        reason: 'contraflow',
        side: contraflow.side,
      })
      continue
    }

    // sides where the tag says another direction than the default
    const differs = sides.filter((side) => sideOnewayDefault(tags, side) !== value)

    if (!differs.length) {
      // Repeats the default. On a track it also says "one direction" (see the top).
      if (!onlyTracks(tags, sides)) {
        findings.push({
          ...base,
          rule: 'cycleway_oneway_redundant',
          kind: 'redundant',
          reason: 'default',
        })
      }
      continue
    }

    // the contraflow lane, tagged as it should be
    if (contraflow && value === contraflow.value && differs.every((s) => s === contraflow.side))
      continue

    if (direction === undefined) {
      // `yes` on the left of a two-way road: "one direction" mixed up with "direction of the way".
      // `-1` on the right is rare and real information.
      if (value === 'yes') {
        findings.push({
          ...base,
          rule: 'cycleway_oneway_wrong',
          kind: 'wrong',
          reason: 'two_way_road',
        })
      }
    } else if (direction === '-1' && value === 'yes') {
      // `oneway=-1`: both sides ride against the drawing direction. `yes` is the same mix-up as on
      // two-way roads (Berlin has `cycleway:both:oneway=yes` there too).
      findings.push({
        ...base,
        rule: 'cycleway_oneway_wrong',
        kind: 'wrong',
        reason: 'reverse_road',
      })
    }
    // `-1` on a `oneway=yes` road: a contraflow lane, real information
  }
  return findings
}

/** Values of `cycleway:<side>` (or `:both`, or `cycleway`) that are bicycle infrastructure on the road */
const ON_ROAD_INFRASTRUCTURE = new Set(['lane', 'track', 'shared_lane', 'share_busway'])

/**
 * A one-way road that bicycles may ride against (`oneway:bicycle=no`) with bicycle infrastructure
 * on the contraflow side (`contraflowSide`) and no direction for it (`cycleway:<side>:oneway`,
 * `cycleway:both:oneway`, `cycleway:oneway`). The wiki default is the direction of the road, but
 * on such a road that side is usually the contraflow lane. Returns the side, the key that holds
 * the infrastructure and the usual contraflow value, or `undefined`.
 */
export function contraflowWithoutDirection(
  tags: OsmTags,
): { side: Side; key: string; value: 'yes' | '-1' } | undefined {
  if (!tags.highway) return undefined
  const contraflow = contraflowSide(tags)
  if (!contraflow) return undefined
  const { side } = contraflow
  const key = [`cycleway:${side}`, 'cycleway:both', 'cycleway'].find((k) => tags[k] !== undefined)
  if (!key || !ON_ROAD_INFRASTRUCTURE.has(tags[key]!)) return undefined
  const directionKeys = [`cycleway:${side}:oneway`, 'cycleway:both:oneway', 'cycleway:oneway']
  if (directionKeys.some((k) => tags[k] !== undefined)) return undefined
  return { side, key, value: contraflow.value }
}

/**
 * The direction a side's `oneway` most likely means. `cycleway:both:oneway=yes` (or
 * `cycleway:oneway=yes`) on a road that is not `oneway=yes` is the usual mix-up of "one direction"
 * with "direction of the way" (common in Berlin): the mapper meant "with the traffic of each side".
 * For that case the side's default (`sideOnewayDefault`); else `undefined` (the tag means what it says).
 * The contraflow side of a road with `oneway=-1` and `oneway:bicycle=no` keeps `yes`: that is its
 * contraflow lane.
 */
export function misreadSharedOneway(tags: OsmTags, side: Side): 'yes' | '-1' | undefined {
  if (tags[`cycleway:${side}:oneway`] !== undefined) return undefined
  const shared = tags['cycleway:both:oneway'] ?? tags['cycleway:oneway']
  if (shared !== 'yes') return undefined
  const fallback = sideOnewayDefault(tags, side)
  if (fallback === 'yes') return undefined
  if (contraflowSide(tags)?.side === side) return undefined
  return fallback
}
