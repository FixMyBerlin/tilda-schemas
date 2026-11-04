import { describe, expect, test } from 'bun:test'
import {
  categorySignOptions,
  listTargetCategories,
  planTagVariantsForCategory,
  planTagsForCategory,
  processBikelanes,
  isIncompleteCategoryId,
  CATEGORY_DEFINITIONS,
  type OsmTags,
} from '../src/index.ts'

test('bare highway=cycleway → footAndCyclewaySegregated_adjoining suggests segregated and is_sidepath', () => {
  const tags = { highway: 'cycleway' }
  const plan = planTagsForCategory(tags, 'footAndCyclewaySegregated_adjoining')
  expect(plan.currentCategoryId).toBe('needsClarification')
  expect(plan.add.some((a) => a.key === 'segregated' && a.value === 'yes')).toBe(true)
  expect(plan.add.some((a) => a.key === 'is_sidepath' && a.value === 'yes')).toBe(true)
  expect(plan.aligned).toBe(true)
})

test('cycleway:right=lane on secondary → cyclewayOnHighway_exclusive suggests nested lane=exclusive', () => {
  const tags = { highway: 'secondary', 'cycleway:right': 'lane' }
  const plan = planTagsForCategory(tags, 'cyclewayOnHighway_exclusive', { side: 'right' })
  expect(plan.currentCategoryId).toBe('cyclewayOnHighway_advisoryOrExclusive')
  expect(plan.add).toEqual([
    expect.objectContaining({
      key: 'cycleway:right:lane',
      value: 'exclusive',
      reason: expect.any(String),
    }),
  ])
})

test('already exclusive → aligned with empty add/change', () => {
  const tags = {
    highway: 'secondary',
    'cycleway:right': 'lane',
    'cycleway:right:lane': 'exclusive',
  }
  const plan = planTagsForCategory(tags, 'cyclewayOnHighway_exclusive', { side: 'right' })
  expect(plan.currentCategoryId).toBe('cyclewayOnHighway_exclusive')
  expect(plan.aligned).toBe(true)
  expect(plan.add).toHaveLength(0)
  expect(plan.change).toHaveLength(0)
  expect(plan.conflicts).toHaveLength(0)
})

test('listTargetCategories returns precise infrastructure-exists ids only', () => {
  const targets = listTargetCategories()
  expect(targets.length).toBeGreaterThan(0)
  for (const id of targets) {
    const def = CATEGORY_DEFINITIONS.find((c) => c.id === id)
    expect(def?.infrastructureExists).toBe(true)
    expect(isIncompleteCategoryId(id)).toBe(false)
  }
  expect(targets).toContain('cycleway_adjoining')
  expect(targets).toContain('cyclewayOnHighway_exclusive')
  expect(targets).not.toContain('needsClarification')
  expect(targets).not.toContain('cycleway_adjoiningOrIsolated')
  expect(targets).not.toContain('cyclewayOnHighway_advisoryOrExclusive')
})

test('listTargetCategories prioritizes unlock candidates from incomplete fromCategory', () => {
  const targets = listTargetCategories({ fromCategory: 'cycleway_adjoiningOrIsolated' })
  expect(targets[0]).toBe('cycleway_adjoining')
  expect(targets).toContain('cycleway_isolated')
})

test('dry-run plan can reach cyclewayOnHighway_exclusive after applying suggestions', () => {
  const tags: OsmTags = { highway: 'secondary', 'cycleway:right': 'lane' }
  const plan = planTagsForCategory(tags, 'cyclewayOnHighway_exclusive', { side: 'right' })
  const next: OsmTags = { ...tags }
  for (const c of plan.change) next[c.key] = c.to
  for (const a of plan.add) if (next[a.key] == null) next[a.key] = a.value
  const results = processBikelanes(next).filter((r) => r._side === 'right')
  expect(results[0]?.category).toBe('cyclewayOnHighway_exclusive')
})

test('residential → bicycleRoad_vehicleDestination suggests bicycle_road and vehicle', () => {
  const tags: OsmTags = { highway: 'residential', name: 'Example' }
  const plan = planTagsForCategory(tags, 'bicycleRoad_vehicleDestination')
  expect(plan.add).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'bicycle_road', value: 'yes' }),
      expect.objectContaining({ key: 'vehicle', value: 'destination' }),
    ]),
  )
  expect(plan.aligned).toBe(true)
  expect(plan.conflicts).toHaveLength(0)

  const next: OsmTags = { ...tags }
  for (const a of plan.add) if (next[a.key] == null) next[a.key] = a.value
  expect(processBikelanes(next)[0]?.category).toBe('bicycleRoad_vehicleDestination')
})

test('residential → bicycleRoad suggests bicycle_road=yes', () => {
  const plan = planTagsForCategory({ highway: 'residential' }, 'bicycleRoad')
  expect(plan.add).toEqual([expect.objectContaining({ key: 'bicycle_road', value: 'yes' })])
  expect(plan.aligned).toBe(true)
})

const entries = (plan: {
  add: { key: string; value: string }[]
  change: { key: string; to: string }[]
}) => [...plan.add.map((e) => `${e.key}=${e.value}`), ...plan.change.map((e) => `${e.key}=${e.to}`)]

function applied(
  tags: OsmTags,
  plan: { add: { key: string; value: string }[]; change: { key: string; to: string }[] },
) {
  const next: OsmTags = { ...tags }
  for (const c of plan.change) next[c.key] = c.to
  for (const a of plan.add) next[a.key] ??= a.value
  return next
}

describe('alternatives: a sign or the tags, never both', () => {
  test('bare path → segregated: segregated=yes, no sign', () => {
    const plan = planTagsForCategory({ highway: 'path' }, 'footAndCyclewaySegregated_isolated')
    expect(plan.aligned).toBe(true)
    expect(entries(plan)).toContain('segregated=yes')
    expect(entries(plan).some((e) => e.startsWith('traffic_sign='))).toBe(false)
  })

  test('DE:241 already holds → no segregated tag added', () => {
    const tags = { highway: 'path', traffic_sign: 'DE:241', is_sidepath: 'no' }
    const plan = planTagsForCategory(tags, 'footAndCyclewaySegregated_isolated')
    expect(plan.currentCategoryId).toBe('footAndCyclewaySegregated_isolated')
    expect(plan.add).toHaveLength(0)
    expect(plan.change).toHaveLength(0)
  })

  test('segregated=yes with access holds → no sign added', () => {
    const tags = { highway: 'path', segregated: 'yes', bicycle: 'designated', foot: 'designated' }
    const plan = planTagsForCategory(tags, 'footAndCyclewaySegregated_adjoining')
    expect(entries(plan)).toEqual(['is_sidepath=yes'])
  })

  test('bare cycleway → cycleway_isolated needs only is_sidepath', () => {
    const plan = planTagsForCategory({ highway: 'cycleway' }, 'cycleway_isolated')
    expect(entries(plan)).toEqual(['is_sidepath=no'])
  })
})

describe('traffic_sign=none is an observed fact', () => {
  for (const target of [
    'footAndCyclewayShared_isolated',
    'footAndCyclewaySegregated_isolated',
    'cycleway_isolated',
    'footwayBicycleYes_isolated',
  ]) {
    test(`${target} keeps traffic_sign=none`, () => {
      const tags = {
        highway: target.startsWith('footway') ? 'footway' : 'path',
        traffic_sign: 'none',
      }
      const plan = planTagsForCategory(tags, target)
      expect(plan.change.map((c) => c.key)).not.toContain('traffic_sign')
      if (plan.aligned) expect(processBikelanes(applied(tags, plan))[0]?.category).toBe(target)
    })
  }

  test('a fixed sign may overwrite it', () => {
    const tags = { highway: 'path', traffic_sign: 'none' }
    const plan = planTagsForCategory(tags, 'footAndCyclewayShared_isolated', {
      fixed: { traffic_sign: 'DE:240' },
    })
    expect(plan.change).toContainEqual(
      expect.objectContaining({ key: 'traffic_sign', from: 'none', to: 'DE:240' }),
    )
    expect(plan.aligned).toBe(true)
  })
})

test('target _adjoining changes is_sidepath=no to yes', () => {
  const tags = { highway: 'path', segregated: 'yes', is_sidepath: 'no' }
  const plan = planTagsForCategory(tags, 'footAndCyclewaySegregated_adjoining')
  expect(plan.change).toContainEqual(
    expect.objectContaining({ key: 'is_sidepath', from: 'no', to: 'yes' }),
  )
  expect(plan.aligned).toBe(true)
  expect(processBikelanes(applied(tags, plan))[0]?.category).toBe(
    'footAndCyclewaySegregated_adjoining',
  )
})

describe('planTagVariantsForCategory', () => {
  test('the first variant is the plan of planTagsForCategory', () => {
    const tags = { highway: 'path' }
    const variants = planTagVariantsForCategory(tags, 'footAndCyclewayShared_isolated')
    expect(variants[0]).toEqual({
      ...planTagsForCategory(tags, 'footAndCyclewayShared_isolated'),
      variantId: 'default',
    })
  })

  test('with sign and without sign', () => {
    const tags = { highway: 'path' }
    const variants = planTagVariantsForCategory(tags, 'footAndCyclewayShared_isolated')
    expect(variants.map((v) => v.variantId)).toEqual(['default', 'with_sign', 'without_sign'])
    expect(entries(variants[1]!)).toEqual(['traffic_sign=DE:240', 'is_sidepath=no'])
    expect(entries(variants[2]!)).toEqual(
      expect.arrayContaining(['traffic_sign=none', 'segregated=no']),
    )
    for (const variant of variants) {
      expect(variant.aligned).toBe(true)
      expect(processBikelanes(applied(tags, variant))[0]?.category).toBe(
        'footAndCyclewayShared_isolated',
      )
    }
  })

  test('no variants for categories without a sign', () => {
    const variants = planTagVariantsForCategory(
      { highway: 'secondary', 'cycleway:right': 'lane' },
      'cyclewayOnHighway_exclusive',
      { side: 'right' },
    )
    expect(variants.map((v) => v.variantId)).toEqual(['default'])
  })

  test('categorySignOptions reads the signs from the specs', () => {
    expect(categorySignOptions('footAndCyclewayShared_adjoining')).toEqual({
      signs: ['DE:240'],
      unsignedPossible: true,
    })
    expect(categorySignOptions('footAndCyclewaySegregated_isolated').signs).toEqual(['DE:241'])
    expect(categorySignOptions('cycleway_isolated').signs).toEqual(['DE:237'])
    expect(categorySignOptions('cyclewayOnHighway_exclusive').signs).toEqual([])
  })
})

test('protected lane: a protective separation from the spec', () => {
  const tags = { highway: 'secondary', 'cycleway:right': 'track' }
  const plan = planTagsForCategory(tags, 'cyclewayOnHighwayProtected', { side: 'right' })
  expect(entries(plan)).toEqual(['cycleway:right:separation:left=bollard'])
  expect(plan.aligned).toBe(true)
})
