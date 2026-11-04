import { expect, test } from 'bun:test'
import { specByCategoryId } from '../src/categories/category-specs.ts'
import {
  processBikelanes,
  analyzeCategoryGaps,
  CATEGORY_SPECS,
  specsWithGapDiscriminators,
} from '../src/index.ts'

test('adjoiningOrIsolated reports missing is_sidepath from spec gapDiscriminators', () => {
  const tags = { highway: 'cycleway', traffic_sign: 'DE:237' }
  const results = processBikelanes(tags)
  const gaps = analyzeCategoryGaps(tags, results)
  const self = gaps.find((g) => g._side === 'self')
  const spec = specByCategoryId('cycleway_adjoiningOrIsolated')
  expect(self?.category).toBe('cycleway_adjoiningOrIsolated')
  expect(self?.incomplete).toBe(true)
  expect(spec?.gapDiscriminators?.[0]).toEqual(
    expect.objectContaining({ key: 'is_sidepath', values: ['yes', 'no'] }),
  )
  expect(self?.missing).toEqual([
    expect.objectContaining({
      key: 'is_sidepath',
      values: ['yes', 'no'],
      unlocksCategory: 'cycleway_adjoining',
      reason: spec?.gapDiscriminators?.[0]?.reason,
    }),
  ])
})

test('sidepath proxy (service highway) auto-resolves gap — no missing discriminators', () => {
  const tags = {
    bicycle: 'designated',
    foot: 'designated',
    highway: 'service',
    motor_vehicle: 'no',
    segregated: 'no',
    service: 'emergency_access',
  }
  const results = processBikelanes(tags)
  const gaps = analyzeCategoryGaps(tags, results)
  const self = gaps.find((g) => g._side === 'self')
  expect(self?.category).toBe('footAndCyclewayShared_isolated')
  expect(self?.incomplete).toBe(false)
  expect(self?.missing).toHaveLength(0)
})

test('track highway auto-resolves sidepath gap', () => {
  const tags = {
    bicycle: 'designated',
    foot: 'designated',
    highway: 'track',
    segregated: 'no',
    traffic_sign: 'DE:240',
  }
  const results = processBikelanes(tags)
  const gaps = analyzeCategoryGaps(tags, results)
  const self = gaps.find((g) => g._side === 'self')
  expect(self?.category).toMatch(/_isolated$/)
  expect(self?.missing).toHaveLength(0)
})

test('advisoryOrExclusive reports missing lane from spec gapDiscriminators', () => {
  const tags = {
    highway: 'secondary',
    'cycleway:right': 'lane',
  }
  const results = processBikelanes(tags).filter((r) => r._infrastructureExists)
  const gaps = analyzeCategoryGaps(tags, results)
  const right = gaps.find((g) => g._side === 'right')
  const spec = specByCategoryId('cyclewayOnHighway_advisoryOrExclusive')
  expect(right?.category).toBe('cyclewayOnHighway_advisoryOrExclusive')
  expect(right?.incomplete).toBe(true)
  expect(spec?.gapDiscriminators?.[0]?.key).toBe('lane')
  expect(right?.missing).toEqual([
    expect.objectContaining({
      key: 'lane',
      values: ['advisory', 'exclusive'],
      unlocksCategory: 'cyclewayOnHighway_advisory',
    }),
  ])
})

test('advisory when lane already set — no gap', () => {
  const tags = {
    highway: 'secondary',
    'cycleway:right': 'lane',
    'cycleway:right:lane': 'advisory',
  }
  const results = processBikelanes(tags).filter((r) => r._infrastructureExists)
  const gaps = analyzeCategoryGaps(tags, results)
  const right = gaps.find((g) => g._side === 'right')
  expect(right?.category).toBe('cyclewayOnHighway_advisory')
  expect(right?.incomplete).toBe(false)
  expect(right?.missing).toHaveLength(0)
})

test('complete category has no gaps', () => {
  const tags = { highway: 'cycleway', is_sidepath: 'yes', traffic_sign: 'DE:237' }
  const results = processBikelanes(tags)
  const gaps = analyzeCategoryGaps(tags, results)
  const self = gaps.find((g) => g._side === 'self')
  expect(self?.category).toBe('cycleway_adjoining')
  expect(self?.incomplete).toBe(false)
  expect(self?.missing).toHaveLength(0)
})

test('needsClarification unlock hints come from spec gapDiscriminators', () => {
  const tags = { highway: 'cycleway' }
  const results = processBikelanes(tags)
  const gaps = analyzeCategoryGaps(tags, results)
  const self = gaps.find((g) => g._side === 'self')
  const spec = CATEGORY_SPECS.find((s) => s.id === 'needsClarification')
  expect(self?.category).toBe('needsClarification')
  expect(self?.incomplete).toBe(true)
  expect(spec?.gapDiscriminators?.length).toBeGreaterThan(0)
  for (const disc of self?.missing ?? []) {
    const fromSpec = spec?.gapDiscriminators?.find(
      (d) => d.key === disc.key && d.unlocksCategory === disc.unlocksCategory,
    )
    expect(fromSpec).toBeDefined()
    expect(disc.reason).toBe(fromSpec!.reason)
    expect(disc.values).toEqual(fromSpec!.values)
  }
  expect(self?.missing.some((m) => m.unlocksCategory != null)).toBe(true)
})

test('analyzer missing keys are a subset of spec gapDiscriminators for incomplete categories', () => {
  const cases = [
    { highway: 'cycleway', traffic_sign: 'DE:237' },
    { highway: 'secondary', 'cycleway:right': 'lane' },
    { highway: 'cycleway' },
  ]
  for (const tags of cases) {
    const results = processBikelanes(tags)
    const gaps = analyzeCategoryGaps(tags, results).filter((g) => g.incomplete)
    for (const gap of gaps) {
      const spec = specByCategoryId(gap.category)
      expect(spec?.gapDiscriminators).toBeDefined()
      const baseId = gap.category
        .replace(/_adjoiningOrIsolated$/, '')
        .replace(/_advisoryOrExclusive$/, '')
      for (const missing of gap.missing) {
        expect(
          spec!.gapDiscriminators!.some((d) => {
            const resolvedUnlock = d.unlocksCategory?.startsWith('_')
              ? `${baseId}${d.unlocksCategory}`
              : d.unlocksCategory
            return d.key === missing.key && resolvedUnlock === missing.unlocksCategory
          }),
        ).toBe(true)
      }
    }
  }
})

test('every spec with gapDiscriminators is reachable as an incomplete category', () => {
  for (const spec of specsWithGapDiscriminators()) {
    if (spec.id === 'needsClarification') continue
    const hasRefining = spec.refining != null && spec.refining.length > 0
    if (hasRefining) {
      const ambiguous = spec.refining!.find(
        (c) => c.idSuffix.endsWith('OrIsolated') || c.idSuffix.endsWith('OrExclusive'),
      )
      expect(ambiguous).toBeDefined()
    }
  }
})
