import { describe, expect, test } from 'bun:test'
import {
  categorySignOptions,
  listTargetCategories,
  planTagVariantsForCategory,
  planTagsForCategory,
  writeKeyForSide,
  TAG_REASON_CODES,
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

describe('reason codes', () => {
  test('every entry has a reasonCode from TAG_REASON_CODES, the English reason stays', () => {
    const cases: [Record<string, string>, string, { side?: 'left' | 'right' | 'self' }?][] = [
      [{ highway: 'cycleway' }, 'footAndCyclewaySegregated_adjoining'],
      [{ highway: 'cycleway' }, 'cycleway_isolated'],
      [{ highway: 'path' }, 'bicycleRoad'],
      [{ highway: 'path' }, 'bicycleRoad_vehicleDestination'],
      [{ highway: 'path' }, 'footwayBicycleYes_adjoining'],
      [
        { highway: 'residential', 'cycleway:right': 'lane' },
        'cyclewayOnHighway_exclusive',
        { side: 'right' },
      ],
      [{ highway: 'residential' }, 'cyclewayOnHighwayProtected', { side: 'right' }],
      [{ highway: 'residential' }, 'cyclewayOnHighwayBetweenLanes', { side: 'right' }],
      [{ highway: 'path' }, 'crossing'],
    ]
    const seen = new Set<string>()
    for (const [tags, target, options] of cases) {
      const plan = planTagsForCategory(tags, target, options)
      for (const entry of [...plan.add, ...plan.change, ...plan.conflicts]) {
        expect(TAG_REASON_CODES).toContain(entry.reasonCode)
        expect(entry.reason.length).toBeGreaterThan(0)
        seen.add(entry.reasonCode)
      }
    }
    expect(seen.has('required_for_category')).toBe(true)
    // `required_for_category` names the category, so the app can write "needed for X"
    const plan = planTagsForCategory({ highway: 'cycleway' }, 'footAndCyclewaySegregated_adjoining')
    expect(plan.add[0]).toMatchObject({
      reasonCode: 'required_for_category',
      reasonParams: { category: 'footAndCyclewaySegregated_adjoining' },
    })
  })

  test('a fixed tag of a mapping target says so', () => {
    const plan = planTagsForCategory(
      { highway: 'path', bicycle: 'designated', foot: 'designated' },
      'footAndCyclewayShared_isolated',
      {
        fixed: { traffic_sign: 'none' },
      },
    )
    expect(plan.add).toContainEqual(
      expect.objectContaining({ key: 'traffic_sign', reasonCode: 'fixed_by_mapping_target' }),
    )
  })

  test('a conflict carries target and result', () => {
    const plan = planTagsForCategory({ highway: 'residential' }, 'cyclewayOnHighwayBetweenLanes', {
      side: 'right',
    })
    expect(plan.aligned).toBe(false)
    expect(plan.conflicts[0]).toMatchObject({
      reasonCode: expect.stringMatching(/^plan_(not_enough|no_edits)$/),
      reasonParams: { target: 'cyclewayOnHighwayBetweenLanes' },
    })
  })
})

describe('writeKeyForSide', () => {
  test('the key that names the road side is the value of cycleway:<side>', () => {
    expect(writeKeyForSide('cycleway', 'right', 'cycleway')).toBe('cycleway:right')
    expect(writeKeyForSide('cycleway', 'left', 'cycleway')).toBe('cycleway:left')
    expect(writeKeyForSide('sidewalk', 'right', 'sidewalk')).toBe('sidewalk:right')
  })

  test('other keys are nested under the side, self keys stay bare', () => {
    expect(writeKeyForSide('lane', 'right', 'cycleway')).toBe('cycleway:right:lane')
    expect(writeKeyForSide('is_sidepath', 'left', 'cycleway')).toBe('cycleway:left:is_sidepath')
    expect(writeKeyForSide('cycleway', 'self', null)).toBe('cycleway')
    // a road side without tags yet: under `cycleway:<side>`, never a bare key on the road
    expect(writeKeyForSide('cycleway', 'right', null)).toBe('cycleway:right')
    expect(writeKeyForSide('lane', 'right', null)).toBe('cycleway:right:lane')
  })

  test('a plan with the bare macro key `cycleway` writes cycleway:right, never cycleway:right:cycleway', () => {
    const tags = { highway: 'secondary', 'cycleway:right': 'shared_lane' }
    for (const target of [
      'sharedBusLaneBusWithBike',
      'cyclewayLink',
      'cyclewayOnHighway_exclusive',
    ]) {
      const plan = planTagsForCategory(tags, target, { side: 'right' })
      const keys = [...plan.add, ...plan.change].map((e) => e.key)
      expect(keys.some((k) => k.endsWith(':cycleway'))).toBe(false)
    }
  })
})

describe('planTagsForCategory on a road side', () => {
  const keys = (plan: { add: { key: string; value: string }[] }) =>
    plan.add.map((entry) => `${entry.key}=${entry.value}`)

  test('a side without tags: the side is set up, nothing goes on the road', () => {
    const road = { highway: 'secondary', name: 'X' }
    const plan = planTagsForCategory(road, 'cyclewayOnHighway_exclusive', { side: 'right' })
    expect(plan.aligned).toBe(true)
    expect(keys(plan)).toEqual(['cycleway:right=lane', 'cycleway:right:lane=exclusive'])
    expect(plan.change).toEqual([])
    expect(plan.remove).toEqual([])
    expect(plan.add[0]).toMatchObject({
      reasonCode: 'side_presence',
      reasonParams: { key: 'cycleway:right' },
    })
  })

  test('never changes highway on a road side', () => {
    const road = { highway: 'residential' }
    for (const target of [
      'cyclewayOnHighway_advisory',
      'cycleway_adjoining',
      'footAndCyclewayShared_adjoining',
      'footAndCyclewaySegregated_adjoining',
      'footwayBicycleYes_adjoining',
      'sharedMotorVehicleLane',
    ]) {
      const plan = planTagsForCategory(road, target, { side: 'left' })
      const written = [...plan.add.map((e) => e.key), ...plan.change.map((e) => e.key)]
      expect({
        target,
        written: written.filter((key) => !/^(cycleway|sidewalk):left/.test(key)),
      }).toEqual({ target, written: [] })
      expect({ target, aligned: plan.aligned }).toEqual({ target, aligned: true })
    }
  })

  test('cycleway:both is split so one side can change', () => {
    const road = { highway: 'secondary', 'cycleway:both': 'lane' }
    const plan = planTagsForCategory(road, 'cycleway_adjoining', { side: 'right' })
    expect(plan.aligned).toBe(true)
    expect(plan.remove).toEqual(['cycleway:both'])
    expect(keys(plan)).toContain('cycleway:left=lane')
    expect(keys(plan)).toContain('cycleway:right=track')
    expect(plan.add.find((e) => e.key === 'cycleway:left')).toMatchObject({
      reasonCode: 'split_both_sides',
      reasonParams: { from: 'cycleway:both' },
    })
  })

  test('a side that already fits needs no split', () => {
    const road = {
      highway: 'secondary',
      'cycleway:both': 'lane',
      'cycleway:both:lane': 'exclusive',
    }
    const plan = planTagsForCategory(road, 'cyclewayOnHighway_exclusive', { side: 'right' })
    expect(plan).toMatchObject({ aligned: true, add: [], change: [], remove: [] })
  })
})

describe('planTagsForCategory: splitting cycleway:both', () => {
  const keys = (plan: ReturnType<typeof planTagsForCategory>) => ({
    add: plan.add.map((e) => `${e.key}=${e.value}`).sort(),
    remove: [...plan.remove].sort(),
  })

  test('moves the sub-keys of cycleway:both to both sides', () => {
    const plan = planTagsForCategory(
      { highway: 'residential', 'cycleway:both': 'lane', 'cycleway:both:lane': 'advisory' },
      'cyclewayOnHighway_exclusive',
      { side: 'right' },
    )
    expect(plan.aligned).toBe(true)
    expect(keys(plan)).toEqual({
      add: [
        'cycleway:left:lane=advisory',
        'cycleway:left=lane',
        'cycleway:right:lane=exclusive',
        'cycleway:right=lane',
      ],
      remove: ['cycleway:both', 'cycleway:both:lane'],
    })
  })

  test('moves the sub-keys of a bare cycleway, not the side keys', () => {
    const plan = planTagsForCategory(
      {
        highway: 'residential',
        cycleway: 'lane',
        'cycleway:lane': 'advisory',
        'cycleway:left:width': '1.5',
      },
      'cyclewayOnHighway_exclusive',
      { side: 'right' },
    )
    expect(keys(plan).remove).toEqual(['cycleway', 'cycleway:lane'])
    expect(keys(plan).add).not.toContain('cycleway:right:left:width=1.5')
  })

  test('leaves the cycleway of the road alone for a footway with bicycles allowed', () => {
    const plan = planTagsForCategory(
      { highway: 'residential', 'cycleway:both': 'no' },
      'footwayBicycleYes_adjoining',
      { side: 'right' },
    )
    expect(keys(plan)).toEqual({
      add: ['sidewalk:right:bicycle=yes', 'sidewalk:right=yes'],
      remove: [],
    })
  })
})
