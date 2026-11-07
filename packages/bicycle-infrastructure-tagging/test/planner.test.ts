import { describe, expect, it } from 'bun:test'
import {
  applyCategoryPlan,
  categoryForSide,
  categoryGeometryMismatch,
  listTargetCategories,
  planCategoryChange,
  planForMappingChoice,
} from '../src/index.ts'

describe('planCategoryChange', () => {
  it('is the plan of the plain mapping choice of the category', () => {
    const tags = { highway: 'residential', 'cycleway:both': 'no' }
    const { choiceId, ...choicePlan } = planForMappingChoice(
      tags,
      { kind: 'cyclewayOnHighway_advisory' },
      'right',
    )
    expect(choiceId).toBe('cyclewayOnHighway_advisory')
    expect(planCategoryChange(tags, 'cyclewayOnHighway_advisory', 'right')).toEqual(choicePlan)
  })

  it('entries carry a code, the core text stays as reason', () => {
    const plan = planCategoryChange(
      { highway: 'residential', 'cycleway:both': 'no' },
      'cyclewayOnHighway_advisory',
      'right',
    )
    expect(plan.add.find((e) => e.key === 'cycleway:right')).toMatchObject({
      value: 'lane',
      code: 'side_presence',
    })
    expect(plan.add.find((e) => e.key === 'cycleway:left')).toMatchObject({
      value: 'no',
      code: 'split_both_sides',
      params: { from: 'cycleway:both' },
    })
    expect(plan.add.find((e) => e.key === 'cycleway:right:lane')).toMatchObject({
      code: 'category_requirement',
      reason: expect.any(String),
      reasonCode: 'discriminator_for_category',
    })
  })

  it('suggests the shared bus lane on a road side without cycleway:<side>:cycleway', () => {
    const tags = { highway: 'secondary' }
    const plan = planCategoryChange(tags, 'sharedBusLaneBusWithBike', 'right')
    const next = applyCategoryPlan(tags, plan)
    expect(next['cycleway:right']).toBe('share_busway')
    expect(Object.keys(next)).not.toContain('cycleway:right:cycleway')
    expect(Object.keys(next)).not.toContain('cycleway')
    expect(next.highway).toBe('secondary')
    expect(plan.aligned).toBe(true)
    expect(categoryForSide(next, 'right')).toBe('sharedBusLaneBusWithBike')
  })

  it('suggests tags for bus lanes and crossings on a way of their own', () => {
    const bus = planCategoryChange({ highway: 'cycleway' }, 'sharedBusLaneBikeWithBus', 'self')
    expect(bus.add.map((e) => `${e.key}=${e.value}`)).toContain('lane=share_busway')
    const crossing = planCategoryChange({ highway: 'footway' }, 'crossing', 'self')
    expect(crossing.change.map((e) => e.to)).toContain('cycleway')
  })

  it('geometry mismatches are codes', () => {
    expect(
      categoryGeometryMismatch({ highway: 'footway', footway: 'sidewalk' }, 'bicycleRoad'),
    ).toBe('geometry_bicycle_road_on_sidewalk')
    expect(categoryGeometryMismatch({ highway: 'cycleway' }, 'cyclewayOnHighway_exclusive')).toBe(
      'geometry_lane_needs_road',
    )
    expect(categoryGeometryMismatch({ highway: 'footway' }, 'sharedBusLaneBikeWithBus')).toBe(
      'geometry_bus_lane_needs_road',
    )
    expect(categoryGeometryMismatch({ highway: 'footway', footway: 'sidewalk' }, 'crossing')).toBe(
      'geometry_crossing_on_sidewalk',
    )
    expect(categoryGeometryMismatch({ highway: 'footway' }, 'pedestrianAreaBicycleYes')).toBe(
      'geometry_pedestrian_area_needs_pedestrian',
    )
    expect(
      categoryGeometryMismatch({ highway: 'residential' }, 'cyclewayOnHighway_exclusive'),
    ).toBe(undefined)
    // a protected lane can be a way of its own, other lanes cannot
    expect(categoryGeometryMismatch({ highway: 'cycleway' }, 'cyclewayOnHighwayProtected')).toBe(
      undefined,
    )
    expect(categoryGeometryMismatch({ highway: 'footway' }, 'cyclewayOnHighwayProtected')).toBe(
      'geometry_lane_needs_road',
    )
    // a track is no carriageway
    expect(categoryGeometryMismatch({ highway: 'track' }, 'cyclewayOnHighway_exclusive')).toBe(
      'geometry_lane_needs_road',
    )
    const plan = planCategoryChange({ highway: 'cycleway' }, 'cyclewayOnHighway_exclusive', 'self')
    expect(plan.conflicts[0]).toMatchObject({
      code: 'geometry_lane_needs_road',
      key: 'highway',
      params: { highway: 'cycleway' },
    })
  })

  it('a plan that is not enough says which category the tags give', () => {
    const plan = planCategoryChange(
      { highway: 'residential', 'cycleway:right': 'lane' },
      'cyclewayOnHighwayBetweenLanes',
      'self',
    )
    expect(plan.aligned).toBe(false)
    expect(plan.conflicts[0]).toMatchObject({
      code: expect.stringMatching(/^(tags_not_enough|no_suggestion)$/),
    })
  })

  it('every offered target on a road side reaches its category or reports a conflict', () => {
    for (const target of listTargetCategories()) {
      const plan = planCategoryChange({ highway: 'secondary' }, target, 'right')
      expect(plan.targetCategoryId).toBe(target)
      if (plan.aligned) {
        const next = applyCategoryPlan({ highway: 'secondary' }, plan)
        expect(categoryForSide(next, 'right')).toBe(target)
      } else {
        expect(plan.conflicts.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('categoryGeometryMismatch with a side', () => {
  it('road centerline, road side and ways of their own', () => {
    const road = { highway: 'residential' }
    expect(categoryGeometryMismatch(road, 'cycleway_adjoining', 'self')).toBe(
      'geometry_path_needs_road_side',
    )
    expect(categoryGeometryMismatch(road, 'cyclewayOnHighway_exclusive', 'self')).toBe(
      'geometry_lane_needs_road_side',
    )
    expect(categoryGeometryMismatch(road, 'bicycleRoad', 'right')).toBe('geometry_not_a_road_side')
    expect(categoryGeometryMismatch(road, 'cycleway_isolated', 'right')).toBe(
      'geometry_isolated_not_a_road_side',
    )
    expect(categoryGeometryMismatch(road, 'cycleway_adjoining', 'right')).toBe(undefined)
    // without a side only the rules that hold for any side (as before)
    expect(categoryGeometryMismatch(road, 'cycleway_adjoining')).toBe(undefined)
  })
})
