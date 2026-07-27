/**
 * Smoke tests ported from the LUA `__tests__/bikelane_categories.test.lua`.
 * Verifies the category id of the first infrastructure feature for a given tag set.
 */
import { expect, test } from 'bun:test'
import { processBikelanes } from '../src/index.ts'
import { categorizeBikelane } from '../src/categories/bikelane-categories.ts'

/** Category id from categorizing the way directly (self object), or null. */
function selfCategory(tags: Record<string, string>): string | null {
  return categorizeBikelane({ ...tags }) ?.id ?? null
}

test('hw=cycleway + DE:241 → footAndCyclewaySegregated_adjoiningOrIsolated', () => {
  expect(selfCategory({ highway: 'cycleway', traffic_sign: 'DE:241' })).toBe('footAndCyclewaySegregated_adjoiningOrIsolated')
})

test('hw=footway + DE:241 → no category', () => {
  expect(selfCategory({ highway: 'footway', traffic_sign: 'DE:241' })).toBeNull()
})

test('hw=cycleway + DE:237 → cycleway_adjoiningOrIsolated', () => {
  expect(selfCategory({ highway: 'cycleway', traffic_sign: 'DE:237' })).toBe('cycleway_adjoiningOrIsolated')
})

test('service road shared (bicycle/foot designated, segregated=no) → footAndCyclewayShared_isolated', () => {
  expect(
    selfCategory({
      bicycle: 'designated', foot: 'designated', highway: 'service',
      motor_vehicle: 'no', segregated: 'no', service: 'emergency_access',
    }),
  ).toBe('footAndCyclewayShared_isolated')
})

test('hw=cycleway + is_sidepath=yes + DE:237 → cycleway_adjoining', () => {
  expect(selfCategory({ highway: 'cycleway', is_sidepath: 'yes', traffic_sign: 'DE:237' })).toBe('cycleway_adjoining')
})

test('hw=cycleway + is_sidepath=no + DE:237 → cycleway_isolated', () => {
  expect(selfCategory({ highway: 'cycleway', is_sidepath: 'no', traffic_sign: 'DE:237' })).toBe('cycleway_isolated')
})

test('bicycle road via traffic_sign DE:244', () => {
  expect(selfCategory({ highway: 'residential', traffic_sign: 'DE:244' })).toBe('bicycleRoad')
})

test('cycleway=no → no infrastructure feature emitted', () => {
  const features = processBikelanes({ highway: 'residential', cycleway: 'no' }).filter((f) => f._infrastructureExists)
  expect(features).toHaveLength(0)
})

test('road with cycleway:right=lane,lane=exclusive → right side cyclewayOnHighway_exclusive', () => {
  const features = processBikelanes({
    highway: 'secondary',
    'cycleway:right': 'lane',
    'cycleway:right:lane': 'exclusive',
  }).filter((f) => f._infrastructureExists)
  const right = features.find((f) => f._side === 'right')
  expect(right?.category).toBe('cyclewayOnHighway_exclusive')
})

test('protected bike lane: cycleway:right=track + separation:right=bollard + is_sidepath proxy via parent', () => {
  // A separately-tagged cycleway with physical separation on the left and motor traffic right.
  const cat = selfCategory({
    highway: 'cycleway', is_sidepath: 'yes',
    'separation:left': 'bollard',
  })
  expect(cat).toBe('cyclewayOnHighwayProtected')
})
