import { highwayClass } from '@tilda-geo/bicycle-infrastructure'
import type { OsmTags } from '../types.ts'
import {
  PART_WIDTH_KEYS,
  PATH_HIGHWAYS,
  formatMeters,
  partWidthMismatch,
  partWidthWholeWay,
} from '../widths/part-widths.ts'
import { contraflowWithoutDirection, cyclewayOnewayFindings } from './cycleway-oneway.ts'
import { removeTagsFix, setTagFix } from './fix.ts'
import type { Rule, RuleHit } from './types.ts'

/**
 * Rules of the iD Radnetz Berlin editor (`modules/validations/width_parts.ts`,
 * `cycleway_side_oneway.ts`), as far as they are pure rules on the tags of one way.
 *
 * Overlap with tilda-geo: `cyclewayOnewayFindings` also finds `cycleway:left:oneway=yes` on a road that is
 * not oneway (reason `two_way_road`). That is the todo `unexpected_oneway_direction` of tilda-geo, so the
 * rule here reports only the one-way roads, which the todo leaves out: the contraflow case and `yes` on
 * a road with `oneway=-1` (reason `reverse_road`).
 */

const isPathWay = (tags: OsmTags) => PATH_HIGHWAYS.has(highwayClass(tags) ?? '')

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
        // either one is right: a path may have only the part width, without `width`
        fixes: [
          removeTagsFix(partKeysWithSources(tags, [whole.key])),
          removeTagsFix(partKeysWithSources(tags, ['width'])),
        ],
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
        (finding) =>
          finding.rule === 'cycleway_oneway_wrong' &&
          (finding.reason === 'contraflow' || finding.reason === 'reverse_road'),
      )
      .map((finding): RuleHit => {
        const side = finding.reason === 'contraflow' && finding.side === 'right' ? '_right' : ''
        return {
          scope: 'road',
          keys: [finding.key],
          message: {
            code: `cycleway_oneway_wrong.${finding.reason}${side}`,
            params: { key: finding.key, value: finding.value },
          },
          fixes:
            finding.reason === 'contraflow'
              ? [contraflowFix(tags, finding.key, finding.side ?? 'left')]
              : reverseRoadFixes(tags, finding.key),
        }
      })
  },
}

/**
 * The contraflow value for the contraflow side (`-1` on the left of `oneway=yes`, `yes` on the right
 * of `oneway=-1`). A key for both sides (`cycleway:both:oneway`) goes away and the contraflow side
 * gets its own value; the other side then has the default (with the road), which the key said too.
 * A real direction with the road on the contraflow side is confirmed in the editor (OK), not with a tag.
 */
function contraflowFix(tags: OsmTags, key: string, side: 'left' | 'right') {
  const sideKey = `cycleway:${side}:oneway`
  const value = side === 'left' ? '-1' : 'yes'
  if (key === sideKey) return setTagFix(tags, key, value)
  return {
    message: { code: `fix.contraflow_${side}`, params: { key } },
    remove: [key],
    add: { [sideKey]: value },
  }
}

const TRACK_VALUES = new Set(['track', 'opposite_track'])

/**
 * `yes` on a road with `oneway=-1`: without the key both sides ride with the traffic (`-1`). A track
 * may keep the direction (it says "not both directions"), so there the first fix sets `-1`.
 */
function reverseRoadFixes(tags: OsmTags, key: string) {
  const sides = key.includes(':left:')
    ? ['left']
    : key.includes(':right:')
      ? ['right']
      : ['left', 'right']
  const track = sides.some((side) =>
    TRACK_VALUES.has(tags[`cycleway:${side}`] ?? tags['cycleway:both'] ?? tags.cycleway ?? ''),
  )
  const remove = removeTagsFix([key])
  return track ? [setTagFix(tags, key, '-1'), remove] : [remove]
}

const cyclewayOnewayContraflowMissing: Rule = {
  id: 'cycleway_oneway_contraflow_missing',
  severity: 'warning',
  source: 'radnetz',
  appliesTo: ['road'],
  keys: [
    'cycleway:left:oneway',
    'cycleway:right:oneway',
    'cycleway:left',
    'cycleway:right',
    'cycleway:both',
    'cycleway',
    'oneway:bicycle',
  ],
  message: { code: 'cycleway_oneway_contraflow_missing' },
  check({ tags }) {
    const missing = contraflowWithoutDirection(tags)
    if (!missing) return []
    const { side, key, value } = missing
    const sideKey = `cycleway:${side}:oneway`
    return [
      {
        scope: 'road',
        keys: [sideKey],
        message: {
          code: side === 'right' ? 'cycleway_oneway_contraflow_missing.right' : undefined,
          params: { key, value: tags[key]! },
        },
        // A real direction with the road on that side is rare and confirmed with OK in the editor;
        // tagging the direction of the road would only bring up `cycleway_oneway_wrong`.
        fixes: [setTagFix(tags, sideKey, value), setTagFix(tags, sideKey, 'no')],
      },
    ]
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
      .map((finding): RuleHit => ({
        scope: 'road',
        keys: [finding.key],
        message: { params: { key: finding.key, value: finding.value } },
        fixes: [removeTagsFix([finding.key])],
      }))
  },
}

/**
 * A sidewalk tagged for bicycles and pedestrians is a foot and cycle path: `highway=path` with
 * `is_sidepath=yes`. `bicycle=yes|permissive` stays a sidewalk where bicycles are allowed
 * (TILDA `footwayBicycleYes`).
 */
const sidewalkSharedPath: Rule = {
  id: 'sidewalk_shared_path',
  severity: 'warning',
  source: 'radnetz',
  appliesTo: ['self'],
  keys: ['highway', 'footway', 'bicycle', 'foot', 'is_sidepath'],
  message: { code: 'sidewalk_shared_path' },
  check({ tags }) {
    if (tags.highway !== 'footway' || tags.footway !== 'sidewalk') return []
    if (tags.bicycle !== 'designated') return []
    if (tags.foot !== undefined && tags.foot !== 'designated') return []
    const add: Record<string, string> = {}
    if (tags.foot === undefined) add.foot = 'designated'
    if (tags.is_sidepath === undefined) add.is_sidepath = 'yes'
    return [
      {
        scope: 'self',
        keys: ['highway', 'footway', 'bicycle'],
        fixes: [
          {
            message: { code: 'fix.sidewalk_shared_path', params: {} },
            remove: ['footway'],
            change: { highway: { from: 'footway', to: 'path' } },
            add,
          },
        ],
      },
    ]
  },
}

export const RADNETZ_RULES: readonly Rule[] = [
  widthPartSum,
  widthPartWhole,
  widthPartUnsegregated,
  cyclewayOnewayWrong,
  cyclewayOnewayContraflowMissing,
  cyclewayOnewayRedundant,
  sidewalkSharedPath,
]
