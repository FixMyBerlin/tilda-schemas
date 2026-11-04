/**
 * Ported from tilda-geo `processing/topics/helper/__tests__/parse_length.test.lua` and
 * `parse_width.test.lua` (state of 2026-11-04). Table-driven cases that also exist as fixtures live in
 * `schemas/bicycle-infrastructure-attributes/fixtures/width`.
 */
import { describe, expect, test } from 'bun:test'
import { parseLength, parseWidth } from '../src/index.ts'

describe('parseLength', () => {
  const readable: Array<[string, number]> = [
    ['1.2', 1.2],
    ['120 cm', 1.2],
    ['120cm', 1.2],
    ['1.2m', 1.2],
    ['1.2 m', 1.2],
    ['1.2 km', 1200],
    ['3 ', 3],
    ['.5', 0.5],
    ['5.', 5],
  ]
  for (const [value, expected] of readable) {
    test(`parse "${value}" as ${expected}`, () => {
      expect(parseLength(value)).toBe(expected)
    })
  }

  test('parse 120.1cm as 1.201', () => {
    expect(Math.abs((parseLength('120.1cm') as number) - 1.201)).toBeLessThan(0.00001)
  })

  test('nil stays nil', () => {
    expect(parseLength(undefined)).toBeUndefined()
    expect(parseLength(null)).toBeUndefined()
  })

  test('0 is kept for `buffer=0`', () => {
    expect(parseLength('0')).toBe(0)
    expect(parseLength(0)).toBe(0)
    expect(parseLength('-0')).toBe(0)
  })

  describe('common decimal commas', () => {
    const variants: Record<string, number> = {
      '0,3': 0.3,
      '0,5': 0.5,
      '0,6': 0.6,
      '1,5': 1.5,
      '2,2': 2.2,
      '2,5': 2.5,
      '2,50': 2.5,
    }
    for (const [value, expected] of Object.entries(variants)) {
      test(`parse ${value} as ${expected}`, () => {
        expect(parseLength(value)).toBe(expected)
      })
    }
  })

  // Values of `width` on highways in Germany (Geofabrik extract 2026-10) that stay unreadable.
  describe('OSM variants without a clear single value', () => {
    const variants = [
      // Decimal comma outside of the lookup
      '1,2 m',
      '5,7',
      '0,8',
      '0,5m',
      ',5',
      // Negative
      '-1',
      '-2 m',
      // Lists and ranges
      '0.5;1',
      '1;1.5',
      '=;%',
      '1-2',
      '0,5 - 1',
      '2-3m',
      '0.5 to 1',
      // Units tilda-geo does not convert, or that are misspelled
      '0.6 mi',
      '3M',
      '3 Meter',
      '1c',
      '2 mm',
      '2 mtr',
      '3 ft',
      "6'",
      '"',
      '2q',
      // Whitespace the unit pattern does not allow
      '3  m',
      ' 3',
      '2 5',
      // Text
      '120 cm Weg',
      'narrow',
      'Weg',
      'FIXME',
      '< 0.5',
      'ca. 3',
      // Not a number
      '3..5',
      '.',
      '-',
      '',
    ]
    for (const value of variants) {
      test(`undefined for "${value}"`, () => {
        expect(parseLength(value)).toBeUndefined()
      })
    }
  })

  test('only ever returns a number or undefined', () => {
    for (const value of ['3', '0', '0.0', '250', '.5', '5.', '1.2.3', '1.2.3 m', '3 m', '100 cm']) {
      const result = parseLength(value)
      expect(result === undefined || typeof result === 'number').toBe(true)
    }
  })
})

describe('parseWidth', () => {
  test('parses like parseLength', () => {
    expect(parseWidth('2.5')).toBe(2.5)
    expect(parseWidth('250 cm')).toBe(2.5)
    expect(parseWidth('2,5')).toBe(2.5)
  })

  test('keeps unusually high values', () => {
    expect(parseWidth('250')).toBe(250)
  })

  for (const value of ['0', '0.0', '0.00', '0 m', '-1', '-2.5 m', 'narrow']) {
    test(`undefined for "${value}"`, () => {
      expect(parseWidth(value)).toBeUndefined()
    })
  }

  test('nil stays nil', () => {
    expect(parseWidth(undefined)).toBeUndefined()
  })
})
