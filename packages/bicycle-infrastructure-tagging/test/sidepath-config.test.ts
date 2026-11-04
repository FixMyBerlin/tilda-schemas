import { describe, expect, it } from 'bun:test'
import {
  combinedPathTags,
  cyclewayKind,
  extractOptions,
  mergeSelection,
  sidepathOffsetMeters,
  type MergeWay,
} from '../src/index.ts'

describe('merging reads widths like the processing', () => {
  it('width=150cm is 1.5 m, not 150 m', () => {
    const { tags } = combinedPathTags(
      { highway: 'cycleway', width: '150cm' },
      { highway: 'footway', width: '2.5' },
    )
    expect(tags).toMatchObject({ 'cycleway:width': '150cm', 'footway:width': '2.5', width: '4' })
  })

  it('reads decimal commas of the processing, and skips widths it cannot read', () => {
    expect(
      combinedPathTags({ highway: 'cycleway', width: '1,5' }, { highway: 'footway', width: '2.5' })
        .tags.width,
    ).toBe('4')
    expect(
      combinedPathTags({ highway: 'cycleway', width: '3 ft' }, { highway: 'footway', width: '2.5' })
        .tags.width,
    ).toBeUndefined()
  })

  it('the length tolerances are configuration', () => {
    const way = (id: string, tags: object, changeset: number, lengthMeters: number): MergeWay => ({
      id,
      tags: tags as MergeWay['tags'],
      changeset,
      lengthMeters,
    })
    const ways = [
      way('w1', { highway: 'cycleway' }, 1, 30),
      way('w2', { highway: 'footway' }, 2, 50),
    ]
    expect(mergeSelection(ways)).toMatchObject({ disabled: false, cut: 'foot' })
    expect(mergeSelection(ways, { lengthToleranceMeters: 25 })).not.toHaveProperty('cut')
  })
})

describe('extracting a side', () => {
  it('reads width=150cm of the track as 1.5 m', () => {
    const road = {
      highway: 'residential',
      'cycleway:right': 'track',
      'cycleway:right:width': '150cm',
    }
    // 4 (road) + 1 (kerb) + 1.5 / 2
    expect(sidepathOffsetMeters(road, 'right', 'cycleway')).toBe(5.75)
  })

  it('offsets and defaults are configuration, the current values are the defaults', () => {
    const road = { highway: 'residential', 'cycleway:right': 'track', 'parking:right': 'lane' }
    expect(sidepathOffsetMeters(road, 'right', 'cycleway')).toBe(8)
    expect(sidepathOffsetMeters(road, 'right', 'cycleway', { kerbMeters: 0.5 })).toBe(7.5)
    expect(
      sidepathOffsetMeters(road, 'right', 'cycleway', {
        parkingMeters: { parallel: 2.2, diagonal: 4.5, perpendicular: 5, halfOnKerb: 1, onKerb: 2 },
        defaultTrackWidthMeters: 3,
      }),
    ).toBe(4 + 2.2 + 1 + 1.5)
  })

  it('a lane is protected by the separation values of the processing, not by any separation', () => {
    const lane = { highway: 'primary', 'cycleway:right': 'lane' }
    expect(cyclewayKind({ ...lane, 'cycleway:right:separation:left': 'bollard' }, 'right')).toBe(
      'protected',
    )
    expect(cyclewayKind({ ...lane, 'cycleway:right:separation:left': 'kerb' }, 'right')).toBe(
      undefined,
    )
    expect(cyclewayKind({ ...lane, 'cycleway:right:separation:left': 'no' }, 'right')).toBe(
      undefined,
    )
    expect(extractOptions({ ...lane, 'cycleway:right:separation:left': 'greenery' })).toEqual([])
  })
})
