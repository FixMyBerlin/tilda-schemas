import { describe, expect, test } from 'bun:test'
import { BIKELANE_TODOS, ROAD_TODOS } from '@tilda-geo/bicycle-infrastructure'
import {
  MESSAGES,
  RADNETZ_RULES,
  RULES,
  RULE_DESCRIPTIONS,
  TILDA_GEO_RULES,
  activeRules,
  applyTagFix,
  renderMessage,
  ruleDescription,
  validateTags,
  type Finding,
  type OsmTags,
  type ValidationOptions,
} from '../src/index.ts'

interface RuleCase {
  /** tags that trigger the rule */
  trigger: OsmTags
  /** tags that look similar and do not */
  quiet: OsmTags
  options?: ValidationOptions
}

const RADNETZ: ValidationOptions = { profile: 'radnetz-berlin' }

const PATH = { highway: 'path', bicycle: 'designated', foot: 'designated' }
const ROAD = { highway: 'residential' }
const CYCLEWAY_237 = { highway: 'cycleway', traffic_sign: 'DE:237', is_sidepath: 'yes' }

/** One trigger and one non-trigger per rule. The test below fails when a rule has no case. */
const CASES: Record<string, RuleCase> = {
  crossing_too_long: {
    trigger: { highway: 'cycleway', cycleway: 'crossing' },
    quiet: { highway: 'cycleway', cycleway: 'crossing' },
    options: { length: 120 },
  },
  needs_clarification: { trigger: { highway: 'cycleway' }, quiet: CYCLEWAY_237 },
  adjoining_or_isolated: {
    trigger: { highway: 'cycleway', traffic_sign: 'DE:237' },
    quiet: CYCLEWAY_237,
  },
  advisory_or_exclusive: {
    trigger: { ...ROAD, 'cycleway:right': 'lane' },
    quiet: { ...ROAD, 'cycleway:right': 'lane', 'cycleway:right:lane': 'exclusive' },
  },
  needs_clarification_track: {
    trigger: { ...ROAD, 'cycleway:right': 'track' },
    quiet: { ...ROAD, 'cycleway:right': 'track', 'cycleway:right:segregated': 'no' },
  },
  mixed_cycleway_both: {
    trigger: { ...ROAD, 'cycleway:both': 'track', 'cycleway:left': 'lane' },
    quiet: { ...ROAD, 'cycleway:both': 'track' },
  },
  unexpected_highway_path: {
    trigger: { highway: 'path', bicycle: 'designated', foot: 'no' },
    quiet: { highway: 'path', bicycle: 'designated', foot: 'yes' },
  },
  missing_traffic_sign_vehicle_destination: {
    trigger: { ...ROAD, bicycle_road: 'yes', vehicle: 'destination', traffic_sign: 'DE:244.1' },
    quiet: {
      ...ROAD,
      bicycle_road: 'yes',
      vehicle: 'destination',
      traffic_sign: 'DE:244.1,1020-30',
    },
  },
  missing_traffic_sign_244: {
    trigger: { ...ROAD, bicycle_road: 'yes' },
    quiet: { ...ROAD, bicycle_road: 'yes', traffic_sign: 'DE:244.1' },
  },
  missing_access_tag_bicycle_road: {
    trigger: { ...ROAD, bicycle_road: 'yes', vehicle: 'no' },
    quiet: { ...ROAD, bicycle_road: 'yes', vehicle: 'no', bicycle: 'designated' },
  },
  missing_traffic_sign: {
    trigger: { ...CYCLEWAY_237, traffic_sign: undefined } as OsmTags,
    quiet: { ...CYCLEWAY_237, traffic_sign: 'none' },
  },
  malformed_traffic_sign: {
    trigger: { ...ROAD, bicycle_road: 'yes', traffic_sign: 'DE:244.1,1020-30, 1026-36' },
    quiet: { ...ROAD, bicycle_road: 'yes', traffic_sign: 'DE:244.1,1020-30,1026-36' },
  },
  missing_access_tag_240: {
    trigger: { highway: 'path', traffic_sign: 'DE:240' },
    quiet: { ...PATH, traffic_sign: 'DE:240', segregated: 'no' },
  },
  missing_segregated: { trigger: PATH, quiet: { ...PATH, segregated: 'yes' } },
  unexpected_bicycle_access_on_footway: {
    trigger: { highway: 'footway', bicycle: 'designated' },
    quiet: { highway: 'footway', bicycle: 'yes' },
  },
  missing_width: { trigger: CYCLEWAY_237, quiet: { ...CYCLEWAY_237, width: '2.5' } },
  unusual_width: {
    trigger: { ...CYCLEWAY_237, width: '250' },
    quiet: { ...CYCLEWAY_237, width: '2.5' },
  },
  missing_surface: {
    trigger: CYCLEWAY_237,
    quiet: { ...CYCLEWAY_237, surface: 'asphalt' },
  },
  missing_oneway: { trigger: CYCLEWAY_237, quiet: { ...CYCLEWAY_237, oneway: 'no' } },
  unexpected_oneway_direction: {
    trigger: { ...ROAD, 'cycleway:left': 'lane', 'cycleway:left:oneway': 'yes' },
    quiet: { ...ROAD, oneway: 'yes', 'cycleway:left': 'lane', 'cycleway:left:oneway': 'yes' },
  },
  deprecated_cycleway_shared: {
    trigger: { ...ROAD, cycleway: 'shared' },
    quiet: { ...ROAD, cycleway: 'lane' },
  },
  width_part_sum: {
    trigger: {
      ...PATH,
      segregated: 'yes',
      width: '4',
      'cycleway:width': '2',
      'footway:width': '1.5',
    },
    quiet: {
      ...PATH,
      segregated: 'yes',
      width: '3.5',
      'cycleway:width': '2',
      'footway:width': '1.5',
    },
    options: RADNETZ,
  },
  width_part_whole: {
    trigger: { ...PATH, segregated: 'yes', width: '1.5', 'cycleway:width': '1.5' },
    quiet: { ...PATH, segregated: 'yes', width: '3', 'cycleway:width': '1.5' },
    options: RADNETZ,
  },
  width_part_unsegregated: {
    trigger: { ...PATH, segregated: 'no', width: '3', 'cycleway:width': '1.5' },
    quiet: { ...PATH, segregated: 'yes', width: '3', 'cycleway:width': '1.5' },
    options: RADNETZ,
  },
  cycleway_oneway_wrong: {
    trigger: {
      ...ROAD,
      oneway: 'yes',
      'oneway:bicycle': 'no',
      'cycleway:left': 'track',
      'cycleway:left:oneway': 'yes',
    },
    quiet: { ...ROAD, oneway: 'yes', 'cycleway:left': 'track', 'cycleway:left:oneway': 'yes' },
    options: RADNETZ,
  },
  cycleway_oneway_redundant: {
    trigger: { ...ROAD, 'cycleway:right': 'track', 'cycleway:right:oneway': 'yes' },
    quiet: { ...ROAD, 'cycleway:right': 'track' },
    options: RADNETZ,
  },
}

const ids = (findings: Finding[]) => findings.map((finding) => finding.ruleId)

describe('the catalogue', () => {
  test('every rule has an id once, and a case in this file', () => {
    const all = RULES.map((rule) => rule.id)
    expect(new Set(all).size).toBe(all.length)
    expect(Object.keys(CASES).sort()).toEqual([...all].sort())
  })

  test('every todo of the core is a rule of tilda-geo', () => {
    const todos = new Set([...BIKELANE_TODOS, ...ROAD_TODOS].map((todo) => todo.id))
    expect(new Set(TILDA_GEO_RULES.map((rule) => rule.id))).toEqual(todos)
    expect(TILDA_GEO_RULES.every((rule) => rule.source === 'tilda-geo')).toBe(true)
    expect(RADNETZ_RULES.every((rule) => rule.source === 'radnetz')).toBe(true)
  })

  test('a rule of the Radnetz profile does not repeat a todo of tilda-geo', () => {
    const todos = new Set(TILDA_GEO_RULES.map((rule) => rule.id))
    expect(RADNETZ_RULES.filter((rule) => todos.has(rule.id))).toEqual([])
  })

  test('every rule names scopes, keys and a message in both languages', () => {
    for (const rule of RULES) {
      expect(rule.appliesTo.length, rule.id).toBeGreaterThan(0)
      expect(rule.keys.length, rule.id).toBeGreaterThan(0)
      expect(MESSAGES.de[rule.message.code], `de ${rule.id}`).toBeTruthy()
      expect(MESSAGES.en[rule.message.code], `en ${rule.id}`).toBeTruthy()
    }
  })

  test('both languages have the same codes with the same placeholders', () => {
    const placeholders = (text: string | undefined) =>
      [...(text ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    expect(Object.keys(MESSAGES.de).sort()).toEqual(Object.keys(MESSAGES.en).sort())
    for (const code of Object.keys(MESSAGES.de)) {
      expect(placeholders(MESSAGES.de[code]), code).toEqual(placeholders(MESSAGES.en[code]))
    }
  })
})

describe('validateTags: every rule triggers and stays quiet', () => {
  for (const rule of RULES) {
    const rule_case = CASES[rule.id]
    if (!rule_case) continue
    const options: ValidationOptions = { profile: 'radnetz-berlin', ...rule_case.options }
    const quietOptions: ValidationOptions = { profile: 'radnetz-berlin', ...rule_case.options }
    // crossing_too_long: the quiet case is the short crossing
    if (rule.id === 'crossing_too_long') quietOptions.length = 50

    test(`${rule.id} triggers`, () => {
      const found = validateTags(rule_case.trigger, options).filter((f) => f.ruleId === rule.id)
      expect(found.length).toBeGreaterThan(0)
      for (const finding of found) {
        expect(finding.severity).toBe(rule.severity)
        expect(finding.source).toBe(rule.source)
        expect(rule.appliesTo).toContain(finding.scope)
        expect(finding.keys.length).toBeGreaterThan(0)
        expect(MESSAGES.de[finding.message.code], finding.message.code).toBeTruthy()
        expect(MESSAGES.en[finding.message.code], finding.message.code).toBeTruthy()
        expect(renderMessage(finding.message, 'de')).not.toMatch(/\{\w+\}/)
        expect(renderMessage(finding.message, 'en')).not.toMatch(/\{\w+\}/)
        for (const fix of finding.fixes) {
          expect(MESSAGES.de[fix.message.code], fix.message.code).toBeTruthy()
          expect(renderMessage(fix.message, 'en')).not.toMatch(/\{\w+\}/)
        }
      }
    })

    test(`${rule.id} stays quiet`, () => {
      expect(ids(validateTags(rule_case.quiet, quietOptions))).not.toContain(rule.id)
    })
  }
})

describe('validateTags: scope, keys and messages', () => {
  const find = (tags: OsmTags, id: string, options?: ValidationOptions) =>
    validateTags(tags, options).filter((finding) => finding.ruleId === id)

  test('a lane is found on its side, with the keys as they are in the tags', () => {
    const [finding, ...more] = find(
      { ...ROAD, 'cycleway:left': 'lane', 'cycleway:left:oneway': 'yes' },
      'unexpected_oneway_direction',
    )
    expect(more).toEqual([])
    expect(finding?.scope).toBe('left')
    expect(finding?.keys).toEqual(['cycleway:left:oneway'])
    expect(finding?.message).toEqual({
      code: 'unexpected_oneway_direction',
      params: { key: 'cycleway:left:oneway', value: 'yes' },
    })
    expect(finding?.fixes.map((fix) => fix.remove)).toEqual([['cycleway:left:oneway']])
  })

  test('tags that cover both sides give one finding for the road', () => {
    const found = find(
      { ...ROAD, 'cycleway:both': 'lane', 'cycleway:both:oneway': 'yes' },
      'unexpected_oneway_direction',
    )
    expect(found.map((finding) => [finding.scope, finding.keys])).toEqual([
      ['road', ['cycleway:both:oneway']],
    ])
  })

  test('different tags on the two sides give a finding per side', () => {
    const found = find(
      { ...ROAD, 'cycleway:left': 'track', 'cycleway:right': 'track' },
      'needs_clarification_track',
    )
    expect(found.map((finding) => [finding.scope, finding.keys])).toEqual([
      ['left', ['cycleway:left']],
      ['right', ['cycleway:right']],
    ])
  })

  test('the keys of a side finding are the ones the side reads, wherever they are tagged', () => {
    const [finding] = find(
      { ...ROAD, 'cycleway:both': 'lane', 'cycleway:both:width': 'narrow' },
      'unusual_width',
    )
    expect(finding?.keys).toEqual(['cycleway:both:width'])
    expect(finding?.message.params).toEqual({ width: 'narrow' })
    expect(renderMessage(finding!.message, 'de')).toContain('width=narrow')
  })

  test('mixed tagging is one finding for the road, with the keys that are mixed', () => {
    const found = find(
      { ...ROAD, 'cycleway:both': 'track', 'cycleway:left': 'lane' },
      'mixed_cycleway_both',
    )
    expect(found.map((finding) => [finding.scope, finding.keys])).toEqual([
      ['road', ['cycleway:both', 'cycleway:left']],
    ])
  })

  test('unusual_width is listed once for a way: the road repeats nothing the own line has', () => {
    const found = find({ highway: 'cycleway', width: '0' }, 'unusual_width')
    expect(found.map((finding) => [finding.scope, finding.keys])).toEqual([['self', ['width']]])
    const road = find({ ...ROAD, width: '0' }, 'unusual_width')
    expect(road.map((finding) => [finding.scope, finding.keys])).toEqual([['road', ['width']]])
  })

  test('a lane and the road each have their own width finding', () => {
    const found = find(
      { ...ROAD, width: '-1', 'cycleway:right': 'lane', 'cycleway:right:width': 'narrow' },
      'unusual_width',
    )
    expect(found.map((finding) => [finding.scope, finding.keys])).toEqual([
      ['right', ['cycleway:right:width']],
      ['road', ['width']],
    ])
  })

  test('the length of the way decides crossing_too_long', () => {
    const crossing = { highway: 'cycleway', cycleway: 'crossing' }
    expect(find(crossing, 'crossing_too_long')).toEqual([])
    expect(find(crossing, 'crossing_too_long', { length: 100 })).toEqual([])
    expect(find(crossing, 'crossing_too_long', { length: 101 })).toHaveLength(1)
  })

  test('the message texts are German and English with the values filled in', () => {
    const [finding] = find(
      { ...PATH, segregated: 'yes', width: '4', 'cycleway:width': '2', 'footway:width': '1.5' },
      'width_part_sum',
      RADNETZ,
    )
    expect(finding?.message.params).toEqual({
      width: '4',
      cycleway: '2',
      footway: '1.5',
      sum: '3.5',
    })
    expect(renderMessage(finding!.message, 'de')).toBe(
      'width=4 ist nicht die Summe der Teilbreiten (cycleway:width + footway:width = 3.5).',
    )
    expect(renderMessage(finding!.message, 'en')).toBe(
      'width=4 is not the sum of the part widths (cycleway:width + footway:width = 3.5).',
    )
  })

  test('renderMessage returns the code of a text it does not have', () => {
    expect(renderMessage({ code: 'nope', params: {} }, 'de')).toBe('nope')
  })
})

describe('validateTags: options', () => {
  const partWidth = { ...PATH, segregated: 'yes', width: '1.5', 'cycleway:width': '1.5' }

  test('the Radnetz rules run only with the profile', () => {
    expect(ids(validateTags(partWidth))).not.toContain('width_part_whole')
    expect(ids(validateTags(partWidth, { profile: 'tilda-geo' }))).not.toContain('width_part_whole')
    expect(ids(validateTags(partWidth, RADNETZ))).toContain('width_part_whole')
  })

  test('only and skip pick rules by id', () => {
    const tags = { ...partWidth, surface: undefined } as OsmTags
    expect(ids(validateTags(tags, { ...RADNETZ, only: ['width_part_whole'] }))).toEqual([
      'width_part_whole',
    ])
    expect(ids(validateTags(tags, { ...RADNETZ, skip: ['width_part_whole'] }))).not.toContain(
      'width_part_whole',
    )
    expect(activeRules({ only: ['width_part_whole'] })).toEqual([])
  })

  test('the tags are not changed', () => {
    const tags: OsmTags = { ...ROAD, 'cycleway:left': 'lane', 'cycleway:left:oneway': 'yes' }
    const before = JSON.stringify(tags)
    validateTags(tags, { ...RADNETZ, length: 20 })
    expect(JSON.stringify(tags)).toBe(before)
  })

  test('tags without bike infrastructure give no finding that is about bikes', () => {
    expect(validateTags({}, RADNETZ)).toEqual([])
    expect(validateTags({ highway: 'residential', maxspeed: '30' }, RADNETZ)).toEqual([])
  })
})

describe('validateTags: overlap with tilda-geo', () => {
  const twoWay = { ...ROAD, 'cycleway:left': 'lane', 'cycleway:left:oneway': 'yes' }

  test('a cycleway:left:oneway=yes on a two-way road is the todo of tilda-geo, not a second finding', () => {
    expect(ids(validateTags(twoWay, RADNETZ)).filter((id) => id.includes('oneway'))).toEqual([
      'unexpected_oneway_direction',
    ])
  })

  test('the contraflow case is found by the Radnetz rule only', () => {
    const contraflow = {
      ...ROAD,
      oneway: 'yes',
      'oneway:bicycle': 'no',
      'cycleway:left': 'lane',
      'cycleway:left:oneway': 'yes',
    }
    expect(ids(validateTags(contraflow, RADNETZ)).filter((id) => id.includes('oneway'))).toEqual([
      'cycleway_oneway_wrong',
    ])
  })

  test('part widths of a way without separation are one finding, not three', () => {
    const tags = { ...PATH, segregated: 'no', width: '1.5', 'cycleway:width': '1.5' }
    expect(ids(validateTags(tags, RADNETZ)).filter((id) => id.startsWith('width_part'))).toEqual([
      'width_part_unsegregated',
    ])
  })
})

describe('fixes', () => {
  test('a fix makes its finding go away', () => {
    for (const [id, rule_case] of Object.entries(CASES)) {
      const options: ValidationOptions = { profile: 'radnetz-berlin', ...rule_case.options }
      for (const finding of validateTags(rule_case.trigger, options)) {
        for (const fix of finding.fixes) {
          const next = applyTagFix(rule_case.trigger, fix)
          const again = validateTags(next, options).filter(
            (f) => f.ruleId === finding.ruleId && f.keys.join() === finding.keys.join(),
          )
          // `cycleway_oneway_wrong` -> `no` keeps the tag, but with another meaning
          expect(again, `${id}: ${fix.message.code}`).toEqual([])
        }
      }
    }
  })

  test('there is a fix where the tags say what to do', () => {
    const fixes = (tags: OsmTags, id: string) =>
      validateTags(tags, RADNETZ)
        .filter((finding) => finding.ruleId === id)
        .flatMap((finding) => finding.fixes)
    expect(
      fixes(
        { ...PATH, segregated: 'yes', width: '4', 'cycleway:width': '2', 'footway:width': '1.5' },
        'width_part_sum',
      ),
    ).toEqual([
      {
        message: { code: 'fix.width_part_sum', params: { sum: '3.5' } },
        change: { width: { from: '4', to: '3.5' } },
      },
    ])
    expect(
      fixes(
        {
          ...PATH,
          segregated: 'yes',
          width: '1.5',
          'cycleway:width': '1.5',
          'source:cycleway:width': 'survey',
        },
        'width_part_whole',
      ).map((fix) => fix.remove),
    ).toEqual([['cycleway:width', 'source:cycleway:width']])
    expect(
      fixes(
        { ...ROAD, oneway: 'yes', 'oneway:bicycle': 'no', 'cycleway:left:oneway': 'yes' },
        'cycleway_oneway_wrong',
      ).map((fix) => fix.message.code),
    ).toEqual(['fix.remove_tags', 'fix.set_tag'])
  })

  test('applyTagFix returns new tags and leaves the old ones alone', () => {
    const tags: OsmTags = { highway: 'path', width: '4', 'cycleway:width': '2' }
    const next = applyTagFix(tags, {
      message: { code: 'fix.remove_tags', params: {} },
      remove: ['cycleway:width'],
      add: { surface: 'asphalt' },
      change: { width: { from: '4', to: '3' } },
    })
    expect(next).toEqual({ highway: 'path', width: '3', surface: 'asphalt' })
    expect(tags.width).toBe('4')
  })
})

describe('rule descriptions', () => {
  test('every rule has a plain description in German and English', () => {
    for (const language of ['de', 'en'] as const) {
      for (const rule of RULES) {
        const text = ruleDescription(rule.id, language)
        expect(text, `${language} ${rule.id}`).toBeTruthy()
        // a description is for rules without a finding: no placeholders, no unfinished text
        expect(text, `${language} ${rule.id}`).not.toMatch(/[{}]/)
        expect(text!.length, `${language} ${rule.id}`).toBeGreaterThan(30)
        expect(text, `${language} ${rule.id}`).toMatch(/[.)]$/)
      }
    }
  })

  test('there is no description for a rule that does not exist', () => {
    const ids = new Set(RULES.map((rule) => rule.id))
    for (const language of ['de', 'en'] as const) {
      for (const id of Object.keys(RULE_DESCRIPTIONS[language])) expect(ids.has(id), id).toBe(true)
      expect(Object.keys(RULE_DESCRIPTIONS[language]).length).toBe(RULES.length)
    }
    expect(ruleDescription('nope', 'de')).toBeUndefined()
  })

  test('a description differs from the message of the rule', () => {
    for (const rule of RULES) {
      expect(ruleDescription(rule.id, 'en')).not.toBe(MESSAGES.en[rule.message.code])
    }
  })
})

test('width_part_sum ignores roads: there width is the carriageway', () => {
  const road = { highway: 'residential', width: '9', 'cycleway:width': '1.5', 'footway:width': '2' }
  expect(
    validateTags(road, { profile: 'radnetz-berlin' }).map((finding) => finding.ruleId),
  ).not.toContain('width_part_sum')
})
