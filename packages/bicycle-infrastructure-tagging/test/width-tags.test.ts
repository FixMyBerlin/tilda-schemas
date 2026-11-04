import { describe, expect, it } from 'bun:test'
import { parseWidth as parseOsmWidth } from '@tilda-geo/bicycle-infrastructure'
import { roadWidthFromTags, widthTargetForKey } from '../src/index.ts'

describe('width/width_tags', () => {
  it('parses width values in m, cm and km', () => {
    expect(parseOsmWidth('2.5')).toBe(2.5)
    expect(parseOsmWidth('2.5 m')).toBe(2.5)
    expect(parseOsmWidth('150cm')).toBe(1.5)
    expect(parseOsmWidth('abc')).toBeUndefined()
    expect(parseOsmWidth(undefined)).toBeUndefined()
  })

  it('uses the width tag, else a default by highway type', () => {
    expect(roadWidthFromTags({ highway: 'residential', width: '6' })).toEqual({
      meters: 6,
      explicit: true,
    })
    expect(roadWidthFromTags({ highway: 'primary' })).toEqual({ meters: 18, explicit: false })
    expect(roadWidthFromTags({ highway: 'primary', oneway: 'yes' })).toEqual({
      meters: 12,
      explicit: false,
    })
    expect(roadWidthFromTags({})).toEqual({ meters: 10, explicit: false })
  })

  it('knows which part of the street a width key describes', () => {
    expect(widthTargetForKey('width')).toEqual({ kind: 'way' })
    expect(widthTargetForKey('cycleway:left:width')).toEqual({
      kind: 'side',
      prefix: 'cycleway',
      sides: ['left'],
    })
    expect(widthTargetForKey('sidewalk:both:width')).toEqual({
      kind: 'side',
      prefix: 'sidewalk',
      sides: ['left', 'right'],
    })
    expect(widthTargetForKey('maxwidth')).toBeUndefined()
  })
})
