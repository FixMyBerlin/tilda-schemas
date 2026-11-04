import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { listTargetCategories } from '@tilda-geo/bicycle-infrastructure'
import {
  CATEGORY_GROUPS,
  MAPPING_TARGET_GROUPS,
  MAPPING_TARGET_LABELS,
  MAPPING_TARGETS,
  applyCategoryPlan,
  categoryForSide,
  groupMappingTargets,
  mappingTargetById,
  planCategoryChange,
  planCategoryVariants,
  planForMappingTarget,
} from '../src/index.ts'
import {
  EXPECTED_UNREACHABLE,
  startCases,
  type StartCase,
  type UnreachableRule,
} from './round-trip-cases.ts'

describe('MAPPING_TARGETS', () => {
  it('every category the planner can target has at least one mapping target', () => {
    for (const category of listTargetCategories()) {
      expect(MAPPING_TARGETS.some((target) => target.categoryId === category)).toBe(true)
    }
  })

  it('ids are unique, labels exist in de and en, every target has a legend group', () => {
    const ids = MAPPING_TARGETS.map((target) => target.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const target of MAPPING_TARGETS) {
      expect(MAPPING_TARGET_LABELS.de[target.labelCode]).toBeString()
      expect(MAPPING_TARGET_LABELS.en[target.labelCode]).toBeString()
      expect(target.group).not.toBe('needsClarification')
    }
  })

  it('the initial list of the concept', () => {
    expect(mappingTargetById('footAndCyclewayShared_adjoining:signed')?.fixed).toEqual({
      traffic_sign: 'DE:240',
    })
    expect(mappingTargetById('footAndCyclewayShared_adjoining:unsigned')?.fixed).toEqual({
      traffic_sign: 'none',
      segregated: 'no',
    })
    expect(mappingTargetById('footAndCyclewaySegregated_isolated:signed')?.fixed).toEqual({
      traffic_sign: 'DE:241',
    })
    expect(mappingTargetById('footAndCyclewaySegregated_isolated:unsigned')?.fixed).toEqual({
      traffic_sign: 'none',
      segregated: 'yes',
    })
    // LUA: highway=cycleway + traffic_mode:right=foot is a segregated foot and cycle path
    expect(mappingTargetById('footAndCyclewaySegregated_isolated:twoLines')).toMatchObject({
      fixed: { highway: 'cycleway', 'traffic_mode:right': 'foot' },
      group: 'separated',
      separateWayOnly: true,
    })
    // one attribute, two categories already: no duplicate targets
    expect(mappingTargetById('bicycleRoad')?.variant).toBe('default')
    expect(mappingTargetById('bicycleRoad_vehicleDestination')?.variant).toBe('default')
  })

  it('docs/mapping-targets.md lists every target (bun run mapping-targets-doc)', () => {
    const doc = readFileSync(new URL('../../../docs/mapping-targets.md', import.meta.url), 'utf8')
    for (const target of MAPPING_TARGETS) expect(doc).toContain(`| \`${target.id}\``)
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
    expect(groupMappingTargets().flatMap((group) => group.targets)).toHaveLength(
      MAPPING_TARGETS.length,
    )
  })
})

describe('planCategoryVariants', () => {
  it('the default plan first, then the mapping targets of the category', () => {
    const tags = { highway: 'path' }
    const variants = planCategoryVariants(tags, 'footAndCyclewayShared_isolated', 'self')
    expect(variants.map((v) => v.variantId)).toEqual([
      'default',
      'footAndCyclewayShared_isolated:signed',
      'footAndCyclewayShared_isolated:unsigned',
    ])
    expect(variants[0]).toEqual(planCategoryChange(tags, 'footAndCyclewayShared_isolated', 'self'))
    expect(variants[1]!.add).toContainEqual(
      expect.objectContaining({ key: 'traffic_sign', value: 'DE:240', code: 'mapping_target' }),
    )
  })

  it('a category with one plain target has one variant that names it', () => {
    const variants = planCategoryVariants(
      { highway: 'secondary' },
      'cyclewayOnHighway_exclusive',
      'right',
    )
    expect(variants).toHaveLength(1)
    expect(variants[0]).toMatchObject({
      variantId: 'default',
      mappingTargetId: 'cyclewayOnHighway_exclusive',
    })
  })

  it('a two-line target on a road side is a conflict', () => {
    const plan = planForMappingTarget(
      { highway: 'secondary' },
      'footAndCyclewaySegregated_adjoining:twoLines',
      'right',
    )
    expect(plan.aligned).toBe(false)
    expect(plan.conflicts[0]!.code).toBe('geometry_needs_separate_way')
  })

  it('an unknown id is a conflict', () => {
    expect(planForMappingTarget({ highway: 'path' }, 'nope', 'self').conflicts[0]!.code).toBe(
      'unknown_mapping_target',
    )
  })
})

function fixedValue(next: Record<string, string | undefined>, c: StartCase, key: string) {
  if (c.side === 'self') return next[key]
  return next[`cycleway:${c.side}:${key}`] ?? next[`sidewalk:${c.side}:${key}`]
}

describe('round trip: plan → apply → processBikelanes', () => {
  const cases = startCases()
  const used = new Set<UnreachableRule>()

  for (const target of MAPPING_TARGETS) {
    it(target.id, () => {
      const problems: string[] = []
      for (const c of cases) {
        const plan = planForMappingTarget(c.tags, target.id, c.side)
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
        const category = categoryForSide(next, c.side)
        if (!plan.aligned || category !== target.categoryId) {
          problems.push(`${c.name}: ${category} (${plan.conflicts[0]?.code ?? 'aligned'})`)
          continue
        }
        for (const [key, value] of Object.entries(target.fixed)) {
          if (fixedValue(next, c, key) !== value) problems.push(`${c.name}: ${key}≠${value}`)
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
