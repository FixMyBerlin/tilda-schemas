import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { listTargetCategories } from '@tilda-geo/bicycle-infrastructure'
import {
  CATEGORY_GROUPS,
  MAPPING_KINDS,
  MAPPING_TARGET_GROUPS,
  allMappingChoices,
  applyCategoryPlan,
  categoryForSide,
  groupMappingKinds,
  lifecycleForSide,
  mappingChoiceForCategory,
  mappingChoiceLabel,
  mappingChoiceOptions,
  mappingKindLabel,
  normalizeMappingChoice,
  planForMappingChoice,
  resolveMappingChoice,
} from '../src/index.ts'
import {
  EXPECTED_UNREACHABLE,
  startCases,
  type StartCase,
  type UnreachableRule,
} from './round-trip-cases.ts'

describe('MAPPING_KINDS', () => {
  it('every category the planner can target is a kind or a kind with a position', () => {
    for (const category of listTargetCategories()) {
      const choice = mappingChoiceForCategory(category)
      expect(choice, category).toBeDefined()
      expect(resolveMappingChoice(choice!)?.categoryId).toBe(category)
    }
  })

  it('paths are one kind with two positions; labels exist in de and en', () => {
    expect(MAPPING_KINDS.find((k) => k.id === 'footAndCyclewaySegregated')?.categories).toEqual([
      'footAndCyclewaySegregated_adjoining',
      'footAndCyclewaySegregated_isolated',
    ])
    expect(mappingKindLabel('footAndCyclewaySegregated', 'de')).toBe('Getrennter Rad- und Gehweg')
    expect(mappingKindLabel('cycleway', 'en')).toBe('Cycleway')
    for (const kind of MAPPING_KINDS) {
      expect(mappingKindLabel(kind.id, 'de')).not.toBe(kind.id)
      expect(mappingKindLabel(kind.id, 'en')).not.toBe(kind.id)
      expect(kind.group).not.toBe('needsClarification')
    }
  })

  it('groups follow the legend of tilda-geo and cover the groups of the iD fork', () => {
    expect(MAPPING_TARGET_GROUPS.map((group) => group.id)).toEqual([
      'separated',
      'lane',
      'foot',
      'sidewalk',
      'mixed',
      'needsClarification',
    ])
    const legend = new Set(MAPPING_TARGET_GROUPS.flatMap((group) => group.categories))
    for (const group of CATEGORY_GROUPS) {
      for (const category of group.categories) expect(legend.has(category)).toBe(true)
    }
    expect(groupMappingKinds().flatMap((group) => group.kinds)).toHaveLength(MAPPING_KINDS.length)
  })
})

describe('mapping choices', () => {
  it('the options of a kind depend on the side and on each other', () => {
    expect(mappingChoiceOptions({ kind: 'footAndCyclewaySegregated' }, 'self')).toEqual({
      position: ['adjoining', 'isolated'],
      sign: ['signed', 'unsigned'],
      signValue: 'DE:241',
      lines: ['one', 'two'],
      lifecycle: ['construction', 'temporary'],
    })
    // a road side runs along the road and has no second line
    expect(mappingChoiceOptions({ kind: 'footAndCyclewaySegregated' }, 'right')).toMatchObject({
      position: ['adjoining'],
      lines: [],
    })
    // no sign while under construction
    expect(
      mappingChoiceOptions({ kind: 'footAndCyclewayShared', lifecycle: 'construction' }).sign,
    ).toEqual([])
    // a bicycle road exists only by its sign; it is never temporary
    expect(mappingChoiceOptions({ kind: 'bicycleRoad' })).toEqual({
      position: [],
      sign: [],
      lines: [],
      lifecycle: ['construction'],
    })
  })

  it('normalizing drops what the kind does not offer', () => {
    expect(
      normalizeMappingChoice(
        {
          kind: 'footAndCyclewayShared',
          position: 'isolated',
          sign: 'signed',
          lines: 'two',
          lifecycle: 'construction',
        },
        'right',
      ),
    ).toEqual({ kind: 'footAndCyclewayShared', position: 'adjoining', lifecycle: 'construction' })
    expect(normalizeMappingChoice({ kind: 'bicycleRoad', lifecycle: 'temporary' })).toEqual({
      kind: 'bicycleRoad',
    })
  })

  it('resolves to the category and the tags of the concept', () => {
    const fixed = (choice: Parameters<typeof resolveMappingChoice>[0]) =>
      resolveMappingChoice(choice)?.fixed
    expect(fixed({ kind: 'footAndCyclewayShared', sign: 'signed' })).toEqual({
      traffic_sign: 'DE:240',
    })
    expect(fixed({ kind: 'footAndCyclewayShared', sign: 'unsigned' })).toEqual({
      traffic_sign: 'none',
      segregated: 'no',
    })
    expect(
      fixed({ kind: 'footAndCyclewaySegregated', position: 'isolated', sign: 'unsigned' }),
    ).toEqual({ traffic_sign: 'none', segregated: 'yes' })
    // LUA: highway=cycleway + traffic_mode:right=foot is a segregated foot and cycle path
    expect(resolveMappingChoice({ kind: 'footAndCyclewaySegregated', lines: 'two' })).toMatchObject(
      {
        id: 'footAndCyclewaySegregated:adjoining:two',
        categoryId: 'footAndCyclewaySegregated_adjoining',
        fixed: { highway: 'cycleway', 'traffic_mode:right': 'foot' },
        separateWayOnly: true,
      },
    )
    expect(
      mappingChoiceLabel(
        { kind: 'footAndCyclewaySegregated', position: 'adjoining', sign: 'signed' },
        'de',
      ),
    ).toBe('Getrennter Rad- und Gehweg, straßenbegleitend, beschildert (DE:241)')
  })

  it('docs/mapping-targets.md lists every choice (bun run mapping-targets-doc)', () => {
    const doc = readFileSync(new URL('../../../docs/mapping-targets.md', import.meta.url), 'utf8')
    for (const resolved of allMappingChoices()) expect(doc).toContain(`| \`${resolved.id}\``)
  })

  it('plans construction and temporary on a road side and on a way of its own', () => {
    const keys = (plan: { add: { key: string; value: string }[]; remove: string[] }) => [
      ...plan.add.map((e) => `${e.key}=${e.value}`),
      ...plan.remove.map((key) => `-${key}`),
    ]
    const road = { highway: 'secondary', 'cycleway:right': 'lane' }
    const construction = planForMappingChoice(
      road,
      { kind: 'cyclewayOnHighway_exclusive', lifecycle: 'construction' },
      'right',
    )
    expect(construction.aligned).toBe(true)
    expect(construction.choiceId).toBe('cyclewayOnHighway_exclusive:construction')
    expect(keys(construction).sort()).toEqual([
      '-cycleway:right',
      'construction:cycleway:right=lane',
      'cycleway:right:lane=exclusive',
    ])
    expect(lifecycleForSide(applyCategoryPlan(road, construction), 'right')).toBe('construction')

    const temporary = planForMappingChoice(
      road,
      { kind: 'cyclewayOnHighway_advisory', lifecycle: 'temporary' },
      'right',
    )
    expect(temporary.aligned).toBe(true)
    expect(keys(temporary)).toContain('cycleway:right:temporary=yes')

    const sidewalk = planForMappingChoice(
      { highway: 'secondary', sidewalk: 'both' },
      { kind: 'footwayBicycleYes', lifecycle: 'temporary' },
      'right',
    )
    expect(keys(sidewalk)).toContain('sidewalk:right:temporary=yes')

    const way = planForMappingChoice(
      { highway: 'residential' },
      { kind: 'bicycleRoad', lifecycle: 'construction' },
      'self',
    )
    expect(way.aligned).toBe(true)
    expect(way.change).toContainEqual(
      expect.objectContaining({ key: 'highway', to: 'construction' }),
    )
    expect(keys(way)).toContain('construction=residential')
  })

  it('a temporary choice on a way under construction is a conflict', () => {
    const plan = planForMappingChoice(
      {
        highway: 'construction',
        construction: 'path',
        segregated: 'no',
        bicycle: 'designated',
        foot: 'designated',
        is_sidepath: 'yes',
      },
      { kind: 'footAndCyclewayShared', lifecycle: 'temporary' },
      'self',
    )
    expect(plan.aligned).toBe(false)
    expect(plan.conflicts[0]).toMatchObject({
      code: 'lifecycle_not_reached',
      params: { lifecycle: 'temporary', result: 'construction' },
    })
  })

  it('an unknown kind is a conflict', () => {
    expect(
      planForMappingChoice({ highway: 'path' }, { kind: 'nope' }, 'self').conflicts[0]!.code,
    ).toBe('unknown_mapping_kind')
  })
})

function fixedValue(
  next: Record<string, string | undefined>,
  c: StartCase,
  key: string,
  categoryId: string,
) {
  if (c.side === 'self') return next[key]
  const prefix = categoryId.startsWith('footwayBicycleYes_') ? 'sidewalk' : 'cycleway'
  return next[`${prefix}:${c.side}:${key}`]
}

describe('round trip: plan → apply → processBikelanes', () => {
  const cases = startCases()
  const used = new Set<UnreachableRule>()

  for (const target of allMappingChoices()) {
    it(target.id, () => {
      const problems: string[] = []
      for (const c of cases) {
        // A choice the side does not offer (isolated, two lines on a road side) is not planned there
        if (resolveMappingChoice(target.choice, c.side)?.id !== target.id) continue
        const plan = planForMappingChoice(c.tags, target.choice, c.side)
        const next = applyCategoryPlan(c.tags, plan)
        const rule = EXPECTED_UNREACHABLE.find((r) => r.applies(target, c))
        if (rule) {
          used.add(rule)
          if (plan.aligned || !plan.conflicts.length)
            problems.push(`${c.name}: reachable (${rule.reason})`)
          else if (rule.code && plan.conflicts[0]!.code !== rule.code)
            problems.push(`${c.name}: ${plan.conflicts[0]!.code}, expected ${rule.code}`)
          continue
        }
        const category = categoryForSide(next, c.side, target.categoryId)
        if (!plan.aligned || category !== target.categoryId) {
          problems.push(`${c.name}: ${category} (${plan.conflicts[0]?.code ?? 'aligned'})`)
          continue
        }
        if (lifecycleForSide(next, c.side, target.categoryId) !== target.lifecycle) {
          problems.push(`${c.name}: lifecycle≠${target.lifecycle}`)
          continue
        }
        for (const [key, value] of Object.entries(target.fixed)) {
          // under construction `highway=cycleway` becomes `highway=construction` + `construction=cycleway`
          const written =
            key === 'highway' && target.lifecycle === 'construction'
              ? fixedValue(next, c, 'construction', target.categoryId)
              : fixedValue(next, c, key, target.categoryId)
          if (written !== value) problems.push(`${c.name}: ${key}≠${value}`)
        }
        if (
          c.tags[c.signKey] === 'none' &&
          target.fixed.traffic_sign === undefined &&
          next[c.signKey] !== 'none'
        ) {
          problems.push(`${c.name}: traffic_sign=none overwritten`)
        }
      }
      expect(problems).toEqual([])
    })
  }

  it('every expected-unreachable rule applies to some case', () => {
    expect(EXPECTED_UNREACHABLE.filter((rule) => !used.has(rule)).map((r) => r.reason)).toEqual([])
  })
})
