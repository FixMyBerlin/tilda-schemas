import { expect, test } from 'bun:test'
import {
  listTargetCategories,
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
