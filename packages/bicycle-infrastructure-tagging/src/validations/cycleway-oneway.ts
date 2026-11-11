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
