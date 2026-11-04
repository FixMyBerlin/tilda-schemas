import { describe, expect, it } from 'bun:test'
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import {
  cyclewayOneway,
  cyclewayOnewayFindings,
  planExtraction,
  sideOnewayDefault,
  type OsmTags,
} from '../src/index.ts'

// The riding direction on a road side is the one the processing derives (tilda-geo-private#34,
// not merged yet): sideOnewayDefault, the extraction plan and the validation must agree with it.
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
        expect(result.oneway).toBe('implicit_yes')
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

  it('contraflow: yes on the contraflow side is wrong, a road drawn against its direction is skipped', () => {
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
    ).toEqual([])
  })
})
