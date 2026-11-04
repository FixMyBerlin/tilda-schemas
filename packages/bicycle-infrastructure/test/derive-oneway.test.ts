/**
 * Ported from tilda-geo `derive_oneway.test.lua` of the branch `claude/tilda-oneway-processing-81b448`
 * (follows tilda-geo-private#34, not merged yet). The same cases on whole ways are fixtures in
 * `schemas/bicycle-infrastructure-attributes/fixtures/oneway`; this file tests the function on
 * hand-made transformed tags, like the LUA test does.
 */
import { describe, expect, test } from 'bun:test'
import { deriveOnewayDirection } from '../src/derive/derive-oneway.ts'
import type { BikelaneCategory, OsmTags } from '../src/types.ts'

const category = (implicitOneWay: boolean) => ({ implicitOneWay }) as BikelaneCategory
const noImplicit = category(false)
const implicit = category(true)

function derive(tags: OsmTags, cat: BikelaneCategory = noImplicit) {
  const { oneway, lineReversed } = deriveOnewayDirection(tags, cat)
  return { oneway, lineReversed }
}

/** @param sideOneway value of `cycleway:<side>:oneway` */
function sideTags(side: 'left' | 'right', sideOneway?: string, parent?: OsmTags): OsmTags {
  const tags: OsmTags = { highway: 'cycleway', _side: side, oneway: sideOneway }
  tags._parent = parent ?? { highway: 'secondary' }
  return tags
}

describe('deriveOnewayDirection', () => {
  test('car_not_bike when oneway:bicycle=no and oneway=yes', () => {
    expect(derive({ oneway: 'yes', 'oneway:bicycle': 'no' }).oneway).toBe('car_not_bike')
  })

  test('car_not_bike when oneway:bicycle=no and oneway=-1', () => {
    expect(derive({ oneway: '-1', 'oneway:bicycle': 'no' }).oneway).toBe('car_not_bike')
  })

  test('assumed_no for bidirectional residential roads', () => {
    expect(derive({ highway: 'residential' }).oneway).toBe('assumed_no')
  })

  test('yes when oneway:bicycle=yes', () => {
    expect(derive({ oneway: 'no', 'oneway:bicycle': 'yes' }).oneway).toBe('yes')
  })

  describe('own geometry (`_side=self`)', () => {
    test('oneway=yes runs with the way', () => {
      expect(derive({ highway: 'cycleway', _side: 'self', oneway: 'yes' })).toEqual({
        oneway: 'yes',
        lineReversed: false,
      })
    })

    test('oneway=-1 is an explicit oneway against the way', () => {
      expect(derive({ highway: 'cycleway', _side: 'self', oneway: '-1' })).toEqual({
        oneway: 'yes',
        lineReversed: true,
      })
    })

    test('oneway=1 is the same as yes', () => {
      expect(derive({ highway: 'cycleway', _side: 'self', oneway: '1' })).toEqual({
        oneway: 'yes',
        lineReversed: false,
      })
    })

    test('oneway:bicycle=-1 is an explicit oneway against the way', () => {
      expect(derive({ highway: 'cycleway', 'oneway:bicycle': '-1' })).toEqual({
        oneway: 'yes',
        lineReversed: true,
      })
    })

    test('car_not_bike points along the motor direction', () => {
      expect(derive({ highway: 'residential', oneway: '-1', 'oneway:bicycle': 'no' })).toEqual({
        oneway: 'car_not_bike',
        lineReversed: true,
      })
      expect(derive({ highway: 'residential', oneway: 'yes', 'oneway:bicycle': 'no' })).toEqual({
        oneway: 'car_not_bike',
        lineReversed: false,
      })
    })

    test('missing oneway keeps the category default and runs with the way', () => {
      expect(derive({ highway: 'cycleway', _side: 'self' }, implicit)).toEqual({
        oneway: 'implicit_yes',
        lineReversed: false,
      })
      expect(derive({ highway: 'cycleway', _side: 'self' }, noImplicit)).toEqual({
        oneway: 'assumed_no',
        lineReversed: false,
      })
      expect(derive({ highway: 'service', _side: 'self' }, implicit)).toEqual({
        oneway: 'assumed_no',
        lineReversed: false,
      })
    })
  })

  describe('lanes tagged on the road (`_side=left|right`)', () => {
    test('default on a two-way road: right with the way, left against it', () => {
      expect(derive(sideTags('right'))).toEqual({ oneway: 'implicit_yes', lineReversed: false })
      expect(derive(sideTags('left'))).toEqual({ oneway: 'implicit_yes', lineReversed: true })
    })

    test('the documented defaults tagged explicitly give the same direction', () => {
      expect(derive(sideTags('right', 'yes'))).toEqual({ oneway: 'yes', lineReversed: false })
      expect(derive(sideTags('left', '-1'))).toEqual({ oneway: 'yes', lineReversed: true })
    })

    test('explicit tags against the default are followed literally', () => {
      expect(derive(sideTags('left', 'yes'))).toEqual({ oneway: 'yes', lineReversed: false })
      expect(derive(sideTags('right', '-1'))).toEqual({ oneway: 'yes', lineReversed: true })
    })

    test('default on a oneway=yes road: both sides with the way', () => {
      const parent = { highway: 'secondary', oneway: 'yes' }
      expect(derive(sideTags('right', undefined, parent))).toEqual({
        oneway: 'implicit_yes',
        lineReversed: false,
      })
      expect(derive(sideTags('left', undefined, parent))).toEqual({
        oneway: 'implicit_yes',
        lineReversed: false,
      })
    })

    test('oneway=yes road with oneway:bicycle=no: the left lane is the contraflow lane', () => {
      const parent = { highway: 'residential', oneway: 'yes', 'oneway:bicycle': 'no' }
      expect(derive(sideTags('left', undefined, parent))).toEqual({
        oneway: 'implicit_yes',
        lineReversed: true,
      })
      expect(derive(sideTags('left', '-1', parent))).toEqual({ oneway: 'yes', lineReversed: true })
      expect(derive(sideTags('left', 'yes', parent))).toEqual({
        oneway: 'yes',
        lineReversed: false,
      })
      expect(derive(sideTags('right', undefined, parent))).toEqual({
        oneway: 'implicit_yes',
        lineReversed: false,
      })
    })

    test('oneway=-1 road with oneway:bicycle=no: the right lane is the contraflow lane', () => {
      const parent = { highway: 'residential', oneway: '-1', 'oneway:bicycle': 'no' }
      expect(derive(sideTags('right', undefined, parent))).toEqual({
        oneway: 'implicit_yes',
        lineReversed: false,
      })
      expect(derive(sideTags('left', undefined, parent))).toEqual({
        oneway: 'implicit_yes',
        lineReversed: true,
      })
    })

    test('default on a oneway=-1 road: both sides against the way', () => {
      const parent = { highway: 'secondary', oneway: '-1' }
      expect(derive(sideTags('right', undefined, parent))).toEqual({
        oneway: 'implicit_yes',
        lineReversed: true,
      })
      expect(derive(sideTags('left', undefined, parent))).toEqual({
        oneway: 'implicit_yes',
        lineReversed: true,
      })
    })

    test('two-way lanes keep the side convention', () => {
      expect(derive(sideTags('left', 'no'))).toEqual({ oneway: 'no', lineReversed: true })
      expect(derive(sideTags('right', 'no'))).toEqual({ oneway: 'no', lineReversed: false })
      const parent = { highway: 'secondary', oneway: 'yes' }
      expect(derive(sideTags('left', 'no', parent))).toEqual({ oneway: 'no', lineReversed: true })
    })

    test('does not read the oneway of the road as the oneway of the lane', () => {
      const parent = { highway: 'secondary', oneway: 'yes', 'oneway:bicycle': 'no' }
      expect(derive(sideTags('right', undefined, parent)).oneway).toBe('implicit_yes')
    })
  })
})
