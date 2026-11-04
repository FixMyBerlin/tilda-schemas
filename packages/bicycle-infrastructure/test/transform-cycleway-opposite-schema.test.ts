/**
 * Ported from tilda-geo `transform_cycleway_opposite_schema.test.lua` of the branch
 * `claude/tilda-oneway-processing-81b448` (follows tilda-geo-private#34, not merged yet).
 */
import { describe, expect, test } from 'bun:test'
import type { OsmTags } from '../src/index.ts'
import { transformCyclewayOppositeSchema } from '../src/transform/prepare-tags.ts'

function transform(tags: OsmTags): Record<string, string> {
  transformCyclewayOppositeSchema(tags)
  return Object.fromEntries(Object.entries(tags).filter(([, v]) => v !== undefined)) as Record<
    string,
    string
  >
}

describe('transformCyclewayOppositeSchema', () => {
  test('does nothing when cycleway is lane', () => {
    expect(transform({ cycleway: 'lane' })).toEqual({ cycleway: 'lane' })
  })

  test('does nothing without oneway=yes or oneway=-1', () => {
    expect(transform({ cycleway: 'opposite_lane', oneway: 'no' })).toEqual({
      cycleway: 'opposite_lane',
      oneway: 'no',
    })
  })

  test('opposite when oneway is yes', () => {
    expect(transform({ cycleway: 'opposite', oneway: 'yes' })).toEqual({
      cycleway: 'no',
      'oneway:bicycle': 'no',
      oneway: 'yes',
    })
  })

  test('opposite_lane when oneway is yes', () => {
    expect(transform({ cycleway: 'opposite_lane', oneway: 'yes' })).toEqual({
      'cycleway:right': 'no',
      'cycleway:left': 'lane',
      'cycleway:left:oneway': '-1',
      'oneway:bicycle': 'no',
      oneway: 'yes',
    })
  })

  test('opposite_lane when oneway is -1 (mirrored)', () => {
    expect(transform({ cycleway: 'opposite_lane', oneway: '-1' })).toEqual({
      'cycleway:left': 'no',
      'cycleway:right': 'lane',
      'cycleway:right:oneway': 'yes',
      'oneway:bicycle': 'no',
      oneway: '-1',
    })
  })

  test('opposite when oneway is -1', () => {
    expect(transform({ cycleway: 'opposite', oneway: '-1' })).toEqual({
      cycleway: 'no',
      'oneway:bicycle': 'no',
      oneway: '-1',
    })
  })

  test('keeps an explicit side direction', () => {
    const result = transform({
      cycleway: 'opposite_lane',
      oneway: 'yes',
      'cycleway:left:oneway': 'no',
    })
    expect(result['cycleway:left:oneway']).toBe('no')
  })

  test('opposite_track when oneway is yes', () => {
    expect(transform({ cycleway: 'opposite_track', oneway: 'yes' })).toEqual({
      'cycleway:right': 'no',
      'cycleway:left': 'track',
      'cycleway:left:oneway': '-1',
      'oneway:bicycle': 'no',
      oneway: 'yes',
    })
  })
})
