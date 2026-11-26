import { describe, expect, it } from 'bun:test'
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import {
  canPlanLaneFromSegregatedPath,
  planLaneFromSegregatedPath,
  renderMessage,
  wayPlacement,
  type LonLat,
} from '../src/index.ts'

const path = {
  highway: 'path',
  bicycle: 'designated',
  foot: 'designated',
  segregated: 'yes',
  is_sidepath: 'yes',
  'cycleway:width': '1.6',
  'cycleway:surface': 'asphalt',
  'footway:width': '2.5',
  'footway:surface': 'paving_stones',
  'traffic_mode:right': 'foot',
  lit: 'yes',
}
const road = { highway: 'secondary', 'cycleway:right': 'separate', 'sidewalk:right': 'separate' }
const right = { roadSide: 'right', pathAlongRoad: true } as const

describe('canPlanLaneFromSegregatedPath', () => {
  it('a segregated path as one line, never a crossing or a shared path', () => {
    expect(canPlanLaneFromSegregatedPath(path)).toBe(true)
    expect(
      canPlanLaneFromSegregatedPath({
        highway: 'cycleway',
        foot: 'designated',
        segregated: 'yes',
      }),
    ).toBe(true)
    expect(canPlanLaneFromSegregatedPath({ ...path, segregated: 'no' })).toBe(false)
    expect(canPlanLaneFromSegregatedPath({ ...path, path: 'crossing' })).toBe(false)
    expect(canPlanLaneFromSegregatedPath({ highway: 'cycleway' })).toBe(false)
  })
})

describe('planLaneFromSegregatedPath', () => {
  it('the path becomes the sidewalk, with the widths of its foot part', () => {
    const plan = planLaneFromSegregatedPath(path, road, { ...right, target: 'line' })
    expect(plan.footwayTags).toEqual({
      highway: 'footway',
      footway: 'sidewalk',
      foot: 'designated',
      is_sidepath: 'yes',
      width: '2.5',
      surface: 'paving_stones',
      lit: 'yes',
    })
    expect(plan.review).toEqual([])
  })

  it('as a line: a lane of its own, the road side stays separate', () => {
    const plan = planLaneFromSegregatedPath(path, road, { ...right, target: 'line' })
    expect(plan.laneTags).toEqual({
      highway: 'cycleway',
      cycleway: 'lane',
      lane: 'exclusive',
      width: '1.6',
      surface: 'asphalt',
      oneway: 'yes',
    })
    expect(processBikelanes(plan.laneTags!).map((r) => r.category)).toEqual([
      'cyclewayOnHighway_exclusive',
    ])
    expect(plan.roadTags).toEqual(road)
  })

  it('on the centerline: the road side is the lane, the sidewalk stays separate', () => {
    const plan = planLaneFromSegregatedPath(path, road, {
      ...right,
      target: 'centerline',
      lane: 'advisory',
    })
    expect(plan.laneTags).toBeUndefined()
    expect(plan.roadTags).toEqual({
      highway: 'secondary',
      'cycleway:right': 'lane',
      'cycleway:right:lane': 'advisory',
      'cycleway:right:width': '1.6',
      'cycleway:right:surface': 'asphalt',
      'sidewalk:right': 'separate',
    })
    const sides = processBikelanes(plan.roadTags)
    expect(sides.find((r) => r._side === 'right')?.category).toBe('cyclewayOnHighway_advisory')
  })

  it('the direction: relative to the road line, oneway on the road only where not the default', () => {
    const left = { roadSide: 'left', target: 'centerline' } as const
    const oneway = { ...path, 'oneway:bicycle': 'yes' }
    // drawn against the road line on its left: yes there is the traffic of the left side
    const withTraffic = planLaneFromSegregatedPath(oneway, road, { ...left, pathAlongRoad: false })
    expect(withTraffic.roadTags['cycleway:left:oneway']).toBeUndefined()
    const against = planLaneFromSegregatedPath(oneway, road, { ...left, pathAlongRoad: true })
    expect(against.roadTags['cycleway:left:oneway']).toBe('yes')
    const twoWay = { ...path, 'oneway:bicycle': 'no' }
    expect(
      planLaneFromSegregatedPath(twoWay, road, { ...right, target: 'line' }).laneTags?.oneway,
    ).toBe('no')
    // untagged: with the traffic, -1 on the left of a two-way road
    expect(
      planLaneFromSegregatedPath(path, road, { ...left, pathAlongRoad: true, target: 'line' })
        .laneTags?.oneway,
    ).toBe('-1')
  })

  it('nothing is guessed for the sign, the whole width and use_sidepath', () => {
    const { 'footway:width': _, ...withoutFootWidth } = path
    const plan = planLaneFromSegregatedPath(
      { ...withoutFootWidth, traffic_sign: 'DE:241-31', width: '4' },
      { ...road, 'bicycle:forward': 'use_sidepath' },
      { ...right, target: 'line' },
    )
    expect(plan.footwayTags.traffic_sign).toBe('DE:241-31')
    expect(plan.footwayTags.width).toBeUndefined()
    expect(plan.review.map((r) => r.code)).toEqual([
      'lane_from_path.footway_width',
      'lane_from_path.traffic_sign',
      'lane_from_path.road_use_sidepath',
    ])
    expect(renderMessage(plan.review[1]!, 'de')).toContain('DE:241-31')
  })
})

describe('wayPlacement', () => {
  const METER = 1 / 111_195
  const roadLine: LonLat[] = [
    [13.4, 52.5],
    [13.402, 52.5],
  ]
  it('the side and the drawing direction, without tags', () => {
    const south: LonLat[] = [
      [13.402, 52.5 - 8 * METER],
      [13.4, 52.5 - 8 * METER],
    ]
    expect(wayPlacement(south, roadLine)).toEqual({ side: 'right', along: false })
    expect(wayPlacement([...south].reverse(), roadLine)).toEqual({ side: 'right', along: true })
  })
})
