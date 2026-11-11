import { sideOnewayDefault } from '../oneway.ts'
import type { OsmTags, Side } from '../types.ts'

/**
 * `cycleway:<side>:oneway` on a road. `oneway` refers to the direction of the way, so the usual
 * direction on the left side is `-1`, not `yes`; and the defaults are enough: bicycles ride with
 * the traffic on their side. Two rules, so each can be switched off on its own:
 * - `cycleway_oneway_wrong`: the tag most likely says the wrong direction
 * - `cycleway_oneway_redundant`: the tag repeats the default
 */

export type CyclewayOnewayRuleId = 'cycleway_oneway_wrong' | 'cycleway_oneway_redundant'

export type CyclewayOnewayFinding = {
  /** id of the rule that found it */
  rule: CyclewayOnewayRuleId
  key: string
  value: string
  kind: 'wrong' | 'redundant'
  /** code of the explanation; the app has the texts */
  reason: 'two_way_road' | 'contraflow' | 'default'
}

const ONEWAY_KEYS: Record<string, Side[]> = {
  'cycleway:left:oneway': ['left'],
  'cycleway:right:oneway': ['right'],
  'cycleway:both:oneway': ['left', 'right'],
  'cycleway:oneway': ['left', 'right'],
}

/** The keys `cyclewayOnewayFindings` looks at, to decide if a way needs checking at all */
export const CYCLEWAY_ONEWAY_KEYS = Object.keys(ONEWAY_KEYS)

/** The `cycleway:*:oneway` tags of a road that are likely wrong or not needed */
export function cyclewayOnewayFindings(tags: OsmTags): CyclewayOnewayFinding[] {
  // a road drawn against its one-way direction: too rare to guess
  if (!tags.highway || tags.oneway === '-1') return []

  const contraflowRoad = tags.oneway === 'yes' && tags['oneway:bicycle'] === 'no'
  const findings: CyclewayOnewayFinding[] = []

  for (const [key, sides] of Object.entries(ONEWAY_KEYS)) {
    const value = tags[key]
    if (value !== 'yes' && value !== '-1') continue

    // A one-way road that bicycles may ride against: the processing reads `yes` on the left as
    // "with the road" (wiki default), but on such roads a lane on the left is usually the
    // contraflow lane, which is `-1`. A heuristic for the Radnetz check, not the processing rule.
    if (value === 'yes' && contraflowRoad && sides.includes('left')) {
      findings.push({
        rule: 'cycleway_oneway_wrong',
        key,
        value,
        kind: 'wrong',
        reason: 'contraflow',
      })
      continue
    }

    // sides where the tag says another direction than the default
    const differs = sides.filter((side) => sideOnewayDefault(tags, side) !== value)

    if (value === 'yes') {
      if (differs.length) {
        findings.push({
          rule: 'cycleway_oneway_wrong',
          key,
          value,
          kind: 'wrong',
          reason: 'two_way_road',
        })
      } else {
        findings.push({
          rule: 'cycleway_oneway_redundant',
          key,
          value,
          kind: 'redundant',
          reason: 'default',
        })
      }
    } else if (!differs.length) {
      // `-1` that only repeats the default; a `-1` that differs is rare and real information
      findings.push({
        rule: 'cycleway_oneway_redundant',
        key,
        value,
        kind: 'redundant',
        reason: 'default',
      })
    }
  }
  return findings
}

/** Values of `cycleway:left` (or `:both`, or `cycleway`) that are bicycle infrastructure on the road */
const ON_ROAD_INFRASTRUCTURE = new Set(['lane', 'track', 'shared_lane', 'share_busway'])

/**
 * A one-way road that bicycles may ride against (`oneway=yes` + `oneway:bicycle=no`) with bicycle
 * infrastructure on the left and no direction for it (`cycleway:left:oneway`, `cycleway:both:oneway`,
 * `cycleway:oneway`). The wiki default is the direction of the road, but on such a road the left lane
 * is usually the contraflow lane (`-1`). Returns the key that holds the infrastructure, or `undefined`.
 */
export function contraflowLeftWithoutDirection(tags: OsmTags): string | undefined {
  if (!tags.highway || tags['oneway:bicycle'] !== 'no') return undefined
  if (tags.oneway !== 'yes' && tags.oneway !== '1') return undefined
  const key = ['cycleway:left', 'cycleway:both', 'cycleway'].find((k) => tags[k] !== undefined)
  if (!key || !ON_ROAD_INFRASTRUCTURE.has(tags[key]!)) return undefined
  const directionKeys = ['cycleway:left:oneway', 'cycleway:both:oneway', 'cycleway:oneway']
  if (directionKeys.some((k) => tags[k] !== undefined)) return undefined
  return key
}
