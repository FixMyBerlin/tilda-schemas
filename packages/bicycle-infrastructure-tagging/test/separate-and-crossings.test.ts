import { describe, expect, it } from 'bun:test'
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import {
  SEPARATE_KIND,
  allMappingChoices,
  applyCategoryPlan,
  categoryMappingGroup,
  combinedPathTags,
  extractAndMergeSides,
  extractOptions,
  groupMappingKinds,
  isCrossingSide,
  mappingChoiceForCategory,
  mappingChoiceOptions,
  mappingKindLabel,
  planExtraction,
  planForMappingChoice,
  renderPlanConflict,
  requiredAttributes,
  type OsmTags,
} from '../src/index.ts'
import { radnetzBerlin } from '../src/profiles/radnetz-berlin.ts'

const separate = { kind: SEPARATE_KIND.id }

describe('a road side drawn as a separate way (cycleway:<side>=separate)', () => {
  it('is offered for a road side only, in its own group at the end', () => {
    expect(groupMappingKinds('right').at(-1)).toEqual({ id: 'separateWay', kinds: [SEPARATE_KIND] })
    expect(groupMappingKinds('left').at(-1)?.id).toBe('separateWay')
    expect(groupMappingKinds('self').map((group) => group.id)).not.toContain('separateWay')
    expect(groupMappingKinds().map((group) => group.id)).not.toContain('separateWay')
    expect(allMappingChoices().map((choice) => choice.choice.kind)).not.toContain(SEPARATE_KIND.id)
    expect(mappingChoiceOptions(separate, 'right')).toEqual({
      position: [],
      sign: [],
      lines: [],
      lifecycle: [],
    })
    expect(mappingKindLabel(SEPARATE_KIND.id, 'de')).toBe('Separat geführt (eigene Linie)')
    expect(mappingKindLabel(SEPARATE_KIND.id, 'en')).toBe('Drawn as a separate way')
  })

  it('is the current state when the side is tagged separate', () => {
    const tags = { highway: 'secondary', 'cycleway:right': 'separate' }
    const result = processBikelanes(tags).find((r) => r._side === 'right')!
    expect(mappingChoiceForCategory(result.category)).toEqual(separate)
    expect(categoryMappingGroup(result.category)).toBe('separateWay')
  })

  it('a track side becomes separate, its sub keys go, and nothing stays open', () => {
    const tags = {
      highway: 'secondary',
      'cycleway:left': 'no',
      'cycleway:right': 'track',
      'cycleway:right:surface': 'asphalt',
      'source:cycleway:right:width': 'survey',
      'note:cycleway:right': 'x',
      'check_date:cycleway:right': '2026-01-01',
    }
    const plan = planForMappingChoice(tags, separate, 'right')
    expect(plan.aligned).toBe(true)
    expect(plan.conflicts).toEqual([])
    expect(plan.change).toEqual([
      { key: 'cycleway:right', from: 'track', to: 'separate', code: 'mapping_target' },
    ])
    expect(plan.remove.sort()).toEqual([
      'check_date:cycleway:right',
      'cycleway:right:surface',
      'note:cycleway:right',
      'source:cycleway:right:width',
    ])
    const next = applyCategoryPlan(tags, plan)
    expect(next).toEqual({
      highway: 'secondary',
      'cycleway:left': 'no',
      'cycleway:right': 'separate',
    })
    const side = processBikelanes(next).find((r) => r._side === 'right')!
    expect(requiredAttributes(side, next, { profile: radnetzBerlin })).toEqual([])
  })

  it('"no infrastructure" on the left can become separate too', () => {
    const tags = { highway: 'secondary', 'cycleway:left': 'no', 'cycleway:right': 'track' }
    const plan = planForMappingChoice(tags, separate, 'left')
    expect(plan.aligned).toBe(true)
    expect(plan.currentCategoryId).toBe('data_no')
    expect(applyCategoryPlan(tags, plan)).toEqual({
      highway: 'secondary',
      'cycleway:left': 'separate',
      'cycleway:right': 'track',
    })
  })

  it('splits cycleway:both per side, and merges equal sides back into cycleway:both', () => {
    const both = {
      highway: 'secondary',
      'cycleway:both': 'track',
      'cycleway:both:surface': 'asphalt',
    }
    const split = applyCategoryPlan(both, planForMappingChoice(both, separate, 'right'))
    expect(split).toEqual({
      highway: 'secondary',
      'cycleway:left': 'track',
      'cycleway:left:surface': 'asphalt',
      'cycleway:right': 'separate',
    })
    const plan = planForMappingChoice(split, separate, 'left')
    expect(plan.aligned).toBe(true)
    expect(applyCategoryPlan(split, plan)).toEqual({
      highway: 'secondary',
      'cycleway:both': 'separate',
    })
  })

  it('is a conflict on the way itself', () => {
    const plan = planForMappingChoice({ highway: 'cycleway' }, separate, 'self')
    expect(plan.aligned).toBe(false)
    expect(plan.conflicts[0]?.code).toBe('geometry_separate_needs_road_side')
    expect(renderPlanConflict(plan.conflicts[0]!, 'de')).toContain('Straßenseite')
  })
})

describe('extracting a crossing', () => {
  const extracted = (road: OsmTags, variant: 'cycleway' | 'path', asCrossing?: boolean) =>
    planExtraction(road, variant, 'right', { asCrossing })

  for (const key of ['track', 'lane']) {
    it(`${key}=crossing becomes cycleway=crossing on the cycleway, path=crossing on the path`, () => {
      const road = {
        highway: 'residential',
        'cycleway:right': 'track',
        [`cycleway:right:${key}`]: 'crossing',
        'sidewalk:right': 'yes',
      }
      expect(isCrossingSide(road, 'right')).toBe(true)
      const cycleway = extracted(road, 'cycleway')
      expect(cycleway.wayTags).toMatchObject({ highway: 'cycleway', cycleway: 'crossing' })
      expect(cycleway.wayTags.is_sidepath).toBeUndefined()
      expect(cycleway.wayTags.track).toBeUndefined()
      expect(cycleway.wayTags.lane).toBeUndefined()
      expect(cycleway.roadTags[`cycleway:right:${key}`]).toBeUndefined()

      const path = extracted(road, 'path')
      expect(path.wayTags).toMatchObject({ highway: 'path', path: 'crossing' })
      expect(path.wayTags.is_sidepath).toBeUndefined()
      expect(path.wayTags.track).toBeUndefined()
    })
  }

  it('reads cycleway:both:lane=crossing for each side, and a road under construction', () => {
    const road = {
      highway: 'construction',
      construction: 'residential',
      'cycleway:both': 'track',
      'cycleway:both:lane': 'crossing',
    }
    expect(extracted(road, 'cycleway').wayTags).toMatchObject({
      highway: 'construction',
      construction: 'cycleway',
      cycleway: 'crossing',
    })
  })

  it('keeps other track values, and a sidewalk is never a crossing', () => {
    const road = {
      highway: 'residential',
      'cycleway:right': 'track',
      'cycleway:right:track': 'other',
      'sidewalk:right': 'yes',
    }
    expect(extracted(road, 'cycleway').wayTags).toMatchObject({
      track: 'other',
      is_sidepath: 'yes',
    })
    expect(extracted(road, 'cycleway').wayTags.cycleway).toBeUndefined()
    const marked = { ...road, 'cycleway:right:track': 'crossing' }
    const sidewalk = planExtraction(marked, 'sidewalk', 'right')
    expect(sidewalk.wayTags.footway).toBe('sidewalk')
  })

  it('a plain lane as a line or as a crossing', () => {
    const road = {
      highway: 'residential',
      'cycleway:right': 'lane',
      'cycleway:right:surface': 'asphalt',
    }
    expect(extracted(road, 'cycleway').wayTags).toEqual({
      highway: 'cycleway',
      is_sidepath: 'yes',
      surface: 'asphalt',
      oneway: 'yes',
    })
    expect(extracted(road, 'cycleway', true).wayTags).toEqual({
      highway: 'cycleway',
      cycleway: 'crossing',
      surface: 'asphalt',
      oneway: 'yes',
    })
    expect(extracted(road, 'cycleway', true).roadTags).toEqual({
      highway: 'residential',
      'cycleway:right': 'separate',
    })
  })
})

describe('extract options for lanes and crossings', () => {
  const entries = (tags: OsmTags) =>
    extractOptions(tags, { plainLanes: true }).map(
      (o) =>
        `${o.side} ${o.variant}${o.lane ? ` lane:${o.lane}` : ''}${o.crossing ? ' crossing' : ''}`,
    )

  it('a plain lane: as a line and as a crossing, only with plainLanes, never merged', () => {
    const lane = { highway: 'residential', 'cycleway:right': 'lane' }
    expect(extractOptions(lane)).toEqual([])
    expect(entries(lane)).toEqual([
      'right cycleway lane:line',
      'right cycleway lane:crossing crossing',
    ])
    expect(extractAndMergeSides(lane)).toEqual([])
  })

  it('a lane marked as a crossing: only as a crossing', () => {
    expect(
      entries({
        highway: 'residential',
        'cycleway:right': 'lane',
        'cycleway:right:lane': 'crossing',
      }),
    ).toEqual(['right cycleway lane:crossing crossing'])
  })

  it('nothing for opposite_lane on the right, for a footway, or for a protected lane twice', () => {
    expect(entries({ highway: 'residential', 'cycleway:right': 'opposite_lane' })).toEqual([])
    expect(entries({ highway: 'residential', 'cycleway:left': 'opposite_lane' })).toEqual([
      'left cycleway lane:line',
      'left cycleway lane:crossing crossing',
    ])
    expect(entries({ highway: 'footway', 'cycleway:right': 'lane' })).toEqual([])
    expect(
      entries({
        highway: 'primary',
        'cycleway:right': 'lane',
        'cycleway:right:separation:left': 'bollard',
      }),
    ).toEqual(['right cycleway'])
  })

  it('a track marked as a crossing is extracted, not merged', () => {
    const tags = {
      highway: 'residential',
      'cycleway:both': 'track',
      'cycleway:right:track': 'crossing',
    }
    expect(entries(tags)).toEqual(['right cycleway crossing', 'left cycleway'])
    expect(extractAndMergeSides(tags)).toEqual(['left'])
  })
})

describe('merging two crossings', () => {
  it('a foot crossing and a bike crossing become one path=crossing, without is_sidepath', () => {
    const { tags } = combinedPathTags(
      {
        highway: 'cycleway',
        cycleway: 'crossing',
        crossing: 'traffic_signals',
        is_sidepath: 'yes',
      },
      { highway: 'footway', footway: 'crossing', crossing: 'traffic_signals' },
    )
    expect(tags).toMatchObject({
      highway: 'path',
      path: 'crossing',
      crossing: 'traffic_signals',
      bicycle: 'designated',
      foot: 'designated',
    })
    expect(tags.footway).toBeUndefined()
    expect(tags.cycleway).toBeUndefined()
    expect(tags.is_sidepath).toBeUndefined()
  })

  it('two traffic islands become path=traffic_island', () => {
    const { tags } = combinedPathTags(
      { highway: 'cycleway', cycleway: 'traffic_island' },
      { highway: 'footway', footway: 'traffic_island' },
    )
    expect(tags).toMatchObject({ highway: 'path', path: 'traffic_island' })
    expect(tags.footway).toBeUndefined()
    expect(tags.cycleway).toBeUndefined()
  })

  it('a sidewalk and a cycleway stay a sidepath', () => {
    const { tags } = combinedPathTags(
      { highway: 'cycleway', is_sidepath: 'yes' },
      { highway: 'footway', footway: 'sidewalk' },
    )
    expect(tags.is_sidepath).toBe('yes')
    expect(tags.path).toBeUndefined()
  })
})
