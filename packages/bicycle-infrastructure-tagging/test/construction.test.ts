import { describe, expect, it } from 'bun:test'
import {
  combinedPathTags,
  extractOptions,
  isRoad,
  mergeSelection,
  planExtraction,
  withConstruction,
} from '../src/index.ts'
import { roadAttributes } from './helpers.ts'

// TILDA reads `highway=construction` + `construction=<class>` as that class with
// `lifecycle=construction` (transform_lifecycle_tags.lua); the Baerwaldstraße, way 1061707899
const built = { highway: 'tertiary', 'cycleway:both': 'track', sidewalk: 'separate' }
const underConstruction = { ...built, highway: 'construction', construction: 'tertiary' }

describe('roads under construction', () => {
  it('are roads, with the same options and road attributes as the built road', () => {
    expect(isRoad(underConstruction)).toBe(true)
    expect(extractOptions(underConstruction)).toEqual(extractOptions(built))
    expect(extractOptions(underConstruction)).toHaveLength(2)
    const keys = (tags: Record<string, string>) => roadAttributes(tags).map((row) => row.key)
    expect(keys(underConstruction)).toEqual(keys(built))
    expect(keys(underConstruction).length).toBeGreaterThan(0)
  })

  it('construction with a value that is no highway class is no road', () => {
    const unknown = { ...underConstruction, construction: 'yes' }
    expect(isRoad(unknown)).toBe(false)
    expect(extractOptions(unknown)).toEqual([])
  })

  it('the extracted way is under construction too, the road keeps its state', () => {
    for (const side of ['right', 'left'] as const) {
      const plan = planExtraction(underConstruction, 'cycleway', side)
      const builtPlan = planExtraction(built, 'cycleway', side)
      expect(plan.wayTags).toEqual(withConstruction(builtPlan.wayTags))
      expect(plan.wayTags.highway).toBe('construction')
      expect(plan.wayTags.construction).toBe('cycleway')
      expect(plan.roadTags.highway).toBe('construction')
      expect(plan.roadTags.construction).toBe('tertiary')
      expect(plan.roadTags[`cycleway:${side}`]).toBe('separate')
      expect(plan.offsetMeters).toBe(builtPlan.offsetMeters)
    }
    const withSidewalk = { ...underConstruction, sidewalk: 'both' }
    expect(planExtraction(withSidewalk, 'path', 'right').wayTags).toMatchObject({
      highway: 'construction',
      construction: 'path',
    })
    expect(planExtraction(withSidewalk, 'sidewalk', 'right').wayTags).toMatchObject({
      highway: 'construction',
      construction: 'footway',
      footway: 'sidewalk',
    })
  })
})

describe('foot and cycle path parts under construction', () => {
  const bike = { highway: 'construction', construction: 'cycleway', 'traffic_mode:right': 'foot' }
  const foot = { highway: 'footway', footway: 'sidewalk' }

  it('are parts that merge, and the path is under construction', () => {
    const selection = mergeSelection([
      { id: 'a', tags: bike, changeset: 1, lengthMeters: 100 },
      { id: 'b', tags: foot, changeset: 2, lengthMeters: 100 },
    ])
    expect(selection?.disabled).toBe(false)
    const { tags, dropped } = combinedPathTags(bike, foot)
    expect(tags.highway).toBe('construction')
    expect(tags.construction).toBe('path')
    expect(dropped).toEqual([])
  })

  it('built parts give a built path', () => {
    const builtBike = { highway: 'cycleway', 'traffic_mode:right': 'foot' }
    const { tags } = combinedPathTags(builtBike, foot)
    expect(tags.highway).toBe('path')
    expect(tags.construction).toBeUndefined()
  })
})
