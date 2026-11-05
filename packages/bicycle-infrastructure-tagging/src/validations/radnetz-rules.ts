import type { OsmTags } from '../types.ts'
import {
  PART_WIDTH_KEYS,
  PATH_HIGHWAYS,
  formatMeters,
  partWidthMismatch,
  partWidthWholeWay,
} from '../widths/part-widths.ts'
import { cyclewayOnewayFindings } from './cycleway-oneway.ts'
import { removeTagsFix, setTagFix } from './fix.ts'
import type { Rule, RuleHit } from './types.ts'

/**
 * Rules of the iD Radnetz Berlin editor (`modules/validations/width_parts.ts`,
 * `cycleway_side_oneway.ts`), as far as they are pure rules on the tags of one way.
 *
 * Overlap with tilda-geo: `cyclewayOnewayFindings` also finds `cycleway:left:oneway=yes` on a road that is
 * not oneway (reason `two_way_road`). That is the todo `unexpected_oneway_direction` of tilda-geo, so the
 * rule here reports only the contraflow case, which the todo leaves out (it skips one-way roads).
 */

const isPathWay = (tags: OsmTags) => PATH_HIGHWAYS.has(tags.highway ?? '')

const isUnsegregated = (tags: OsmTags) => tags.segregated === 'no'

/** The part width keys of the tags, with their `source:` keys */
function partKeysWithSources(tags: OsmTags, keys: readonly string[]): string[] {
  return keys.flatMap((key) => [key, `source:${key}`]).filter((key) => tags[key] !== undefined)
}

const widthPartSum: Rule = {
  id: 'width_part_sum',
  severity: 'warning',
  source: 'radnetz',
  appliesTo: ['self'],
  keys: ['width', ...PART_WIDTH_KEYS],
  message: { code: 'width_part_sum' },
  check({ tags }) {
    // On a road `width` is the carriageway, not the sum of the parts.
    // Part widths with `segregated=no` are a finding of their own.
    if (!isPathWay(tags) || isUnsegregated(tags)) return []
    const mismatch = partWidthMismatch(tags)
    if (!mismatch) return []
    const sum = formatMeters(mismatch.sum)
    const meters = (key: string) => mismatch.parts.find((part) => part.key === key)?.meters ?? 0
    const fix = setTagFix(tags, 'width', sum)
    return [
      {
        scope: 'self',
        keys: ['width', ...PART_WIDTH_KEYS],
        message: {
          params: {
            width: formatMeters(mismatch.width),
            cycleway: formatMeters(meters('cycleway:width')),
            footway: formatMeters(meters('footway:width')),
            sum,
          },
        },
        fixes: [{ ...fix, message: { code: 'fix.width_part_sum', params: { sum } } }],
      },
    ]
  },
}

/**
 * An error, also with `segregated=no`: a part as wide as the whole way never makes sense (on a
 * path for bikes only the part width should not be there at all).
 */
const widthPartWhole: Rule = {
  id: 'width_part_whole',
  severity: 'error',
  source: 'radnetz',
  appliesTo: ['self'],
  keys: ['width', ...PART_WIDTH_KEYS],
  message: { code: 'width_part_whole' },
  check({ tags }) {
    const whole = partWidthWholeWay(tags)
    if (!whole) return []
    const part = whole.key === 'cycleway:width' ? 'cycleway' : 'footway'
    return [
      {
        scope: 'self',
        keys: ['width', whole.key],
        message: {
          code: `width_part_whole.${part}`,
          params: {
            key: whole.key,
            meters: formatMeters(whole.meters),
            width: formatMeters(whole.width),
          },
        },
        fixes: [removeTagsFix(partKeysWithSources(tags, [whole.key]))],
      },
    ]
  },
}

const widthPartUnsegregated: Rule = {
  id: 'width_part_unsegregated',
  severity: 'warning',
  source: 'radnetz',
  appliesTo: ['self'],
  keys: ['segregated', ...PART_WIDTH_KEYS],
  message: { code: 'width_part_unsegregated' },
  check({ tags }) {
    if (!isUnsegregated(tags) || !isPathWay(tags)) return []
    // a part as wide as the whole way is the error `width_part_whole`; one finding is enough
    if (partWidthWholeWay(tags)) return []
    const parts = PART_WIDTH_KEYS.filter((key) => tags[key] !== undefined)
    if (!parts.length) return []
    return [
      {
        scope: 'self',
        keys: ['segregated', ...parts],
        message: { params: { keys: parts.join(', ') } },
        fixes: [removeTagsFix(partKeysWithSources(tags, parts))],
      },
    ]
  },
}

const ONEWAY_KEYS = [
  'cycleway:left:oneway',
  'cycleway:right:oneway',
  'cycleway:both:oneway',
  'cycleway:oneway',
]

const cyclewayOnewayWrong: Rule = {
  id: 'cycleway_oneway_wrong',
  severity: 'warning',
  source: 'radnetz',
  appliesTo: ['road'],
  keys: ONEWAY_KEYS,
  message: { code: 'cycleway_oneway_wrong' },
  check({ tags }) {
    return cyclewayOnewayFindings(tags)
      .filter(
        (finding) => finding.rule === 'cycleway_oneway_wrong' && finding.reason === 'contraflow',
      )
      .map(
        (finding): RuleHit => ({
          scope: 'road',
          keys: [finding.key],
          message: {
            code: `cycleway_oneway_wrong.${finding.reason}`,
            params: { key: finding.key, value: finding.value },
          },
          fixes: [removeTagsFix([finding.key]), setTagFix(tags, finding.key, 'no')],
        }),
      )
  },
}

const cyclewayOnewayRedundant: Rule = {
  id: 'cycleway_oneway_redundant',
  severity: 'info',
  source: 'radnetz',
  appliesTo: ['road'],
  keys: ONEWAY_KEYS,
  message: { code: 'cycleway_oneway_redundant' },
  check({ tags }) {
    return cyclewayOnewayFindings(tags)
      .filter((finding) => finding.rule === 'cycleway_oneway_redundant')
      .map(
        (finding): RuleHit => ({
          scope: 'road',
          keys: [finding.key],
          message: { params: { key: finding.key, value: finding.value } },
          fixes: [removeTagsFix([finding.key])],
        }),
      )
  },
}

export const RADNETZ_RULES: readonly Rule[] = [
  widthPartSum,
  widthPartWhole,
  widthPartUnsegregated,
  cyclewayOnewayWrong,
  cyclewayOnewayRedundant,
]
