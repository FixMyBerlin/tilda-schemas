import { describe, expect, it } from 'bun:test'
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import {
  cyclewayOneway,
  cyclewayOnewayFindings,
  planExtraction,
  sideOnewayDefault,
  type OsmTags,
} from '../src/index.ts'

// The riding direction on a road side is the one the processing derives (tilda-geo `6ec40d600`):
// sideOnewayDefault, the extraction plan and the validation must agree with it.
const roads: Record<string, OsmTags> = {
  'two-way road': { highway: 'residential' },
  'one-way road': { highway: 'residential', oneway: 'yes' },
  'one-way road, bicycles both ways': {
    highway: 'residential',
    oneway: 'yes',
    'oneway:bicycle': 'no',
  },
  'one-way road against its drawing direction': { highway: 'residential', oneway: '-1' },
  'oneway=-1, bicycles both ways': {
    highway: 'residential',
    oneway: '-1',
    'oneway:bicycle': 'no',
  },
}

describe('riding direction on a road side', () => {
  for (const [name, road] of Object.entries(roads)) {
    for (const side of ['left', 'right'] as const) {
      it(`${name}, ${side} track: default, processing and extraction agree`, () => {
        const tags = { ...road, [`cycleway:${side}`]: 'track' }
        const result = processBikelanes(tags).find((r) => r._side === side)!
        // a track without a tag: the category decides (both directions), the line follows the side
        expect(result.oneway).toBe('assumed_no')
        const expected = result._lineReversed ? '-1' : 'yes'

        expect(sideOnewayDefault(road, side)).toBe(expected)
        expect(cyclewayOneway(road, side, undefined)).toBe(expected)
        expect(
          planExtraction(tags, 'cycleway', side, { recommend: undefined }).wayTags.oneway,
        ).toBe(expected)
      })
    }
  }

  it('the left side of a one-way road runs with the road, not against it (the fork said -1)', () => {
    expect(sideOnewayDefault({ highway: 'residential', oneway: 'yes' }, 'left')).toBe('yes')
    const plan = planExtraction(
      { highway: 'residential', oneway: 'yes', 'cycleway:left': 'track' },
      'cycleway',
      'left',
      {},
    )
    expect(plan.wayTags.oneway).toBe('yes')
    // the only riding direction is the one of the road: a plain use_sidepath is enough
    const signed = planExtraction(
      {
        highway: 'residential',
        oneway: 'yes',
        'cycleway:left': 'track',
        'cycleway:left:traffic_sign': 'DE:237',
      },
      'cycleway',
      'left',
      {
        recommend: () => ({ bicycle: 'designated', highway: ['cycleway'], traffic_sign: 'DE:237' }),
      },
    )
    expect(signed.roadTags.bicycle).toBe('use_sidepath')
  })

  it('an explicit cycleway:<side>:oneway wins', () => {
    expect(cyclewayOneway({ highway: 'residential' }, 'left', 'no')).toBe('no')
    expect(cyclewayOneway({ highway: 'residential' }, 'right', '-1')).toBe('-1')
  })
})

describe('cyclewayOnewayFindings', () => {
  it('a track on the right of a two-way road: yes repeats the default, -1 is real information', () => {
    expect(
      cyclewayOnewayFindings({ highway: 'residential', 'cycleway:right:oneway': 'yes' }),
    ).toEqual([
      expect.objectContaining({
        rule: 'cycleway_oneway_redundant',
        key: 'cycleway:right:oneway',
        reason: 'default',
      }),
    ])
    expect(
      cyclewayOnewayFindings({ highway: 'residential', 'cycleway:right:oneway': '-1' }),
    ).toEqual([])
  })

  it('yes on the left of a two-way road is most likely the wrong direction', () => {
    expect(
      cyclewayOnewayFindings({ highway: 'residential', 'cycleway:left:oneway': 'yes' }),
    ).toEqual([
      expect.objectContaining({
        rule: 'cycleway_oneway_wrong',
        kind: 'wrong',
        reason: 'two_way_road',
      }),
    ])
  })

  it('on a one-way road the left side runs with the road, so -1 is the unusual one', () => {
    const road = { highway: 'residential', oneway: 'yes' }
    expect(cyclewayOnewayFindings({ ...road, 'cycleway:left:oneway': 'yes' })[0]).toMatchObject({
      kind: 'redundant',
    })
    expect(cyclewayOnewayFindings({ ...road, 'cycleway:left:oneway': '-1' })).toEqual([])
  })

  it('contraflow: yes on the contraflow side is wrong; on oneway=-1 yes is against the traffic', () => {
    expect(
      cyclewayOnewayFindings({
        highway: 'residential',
        oneway: 'yes',
        'oneway:bicycle': 'no',
        'cycleway:left:oneway': 'yes',
      })[0],
    ).toMatchObject({ kind: 'wrong', reason: 'contraflow' })
    expect(
      cyclewayOnewayFindings({
        highway: 'residential',
        oneway: '-1',
        'cycleway:left:oneway': 'yes',
      }),
    ).toEqual([expect.objectContaining({ kind: 'wrong', reason: 'reverse_road' })])
    // the contraflow lane of a oneway=-1 road is on the right, yes
    expect(
      cyclewayOnewayFindings({
        highway: 'residential',
        oneway: '-1',
        'oneway:bicycle': 'no',
        'cycleway:right:oneway': 'yes',
      }),
    ).toEqual([])
  })
})

describe('extraction of cycleway:both:oneway=yes (Berlin)', () => {
  const plan = (road: OsmTags, side: 'left' | 'right') =>
    planExtraction(road, 'cycleway', side, { recommend: undefined })

  it('two-way road: the left track runs against the way, the right one with it', () => {
    const road = { highway: 'residential', 'cycleway:both': 'track', 'cycleway:both:oneway': 'yes' }
    const left = plan(road, 'left')
    expect(left.wayTags.oneway).toBe('-1')
    expect(left.roadTags).toEqual({
      highway: 'residential',
      'cycleway:left': 'separate',
      'cycleway:right': 'track',
      'cycleway:right:oneway': 'yes',
    })
    const right = plan(road, 'right')
    expect(right.wayTags.oneway).toBe('yes')
    expect(right.roadTags['cycleway:left:oneway']).toBe('-1')
    expect(right.roadTags['cycleway:both:oneway']).toBeUndefined()
  })

  it('a side with its own key keeps it', () => {
    const road = {
      highway: 'residential',
      'cycleway:both': 'track',
      'cycleway:both:oneway': 'yes',
      'cycleway:left:oneway': 'no',
    }
    expect(plan(road, 'left').wayTags.oneway).toBe('no')
    expect(plan(road, 'right').wayTags.oneway).toBe('yes')
  })

  it('oneway=-1 road: both sides run against the way; the contraflow lane keeps yes', () => {
    const road = {
      highway: 'residential',
      oneway: '-1',
      'cycleway:both': 'track',
      'cycleway:both:oneway': 'yes',
    }
    expect(plan(road, 'left').wayTags.oneway).toBe('-1')
    expect(plan(road, 'right').wayTags.oneway).toBe('-1')
    const contraflow = { ...road, 'oneway:bicycle': 'no' }
    expect(plan(contraflow, 'left').wayTags.oneway).toBe('-1')
    expect(plan(contraflow, 'right').wayTags.oneway).toBe('yes')
  })

  it('oneway=yes road: yes is the default on both sides and stays', () => {
    const road = {
      highway: 'residential',
      oneway: 'yes',
      'cycleway:both': 'track',
      'cycleway:both:oneway': 'yes',
    }
    expect(plan(road, 'left').wayTags.oneway).toBe('yes')
    expect(plan(road, 'left').roadTags['cycleway:right:oneway']).toBe('yes')
  })
})
