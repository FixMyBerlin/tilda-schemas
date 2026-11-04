import { describe, expect, it } from 'bun:test'
import {
  CATEGORY_SPECS,
  analyzeCategoryGaps,
  processBikelanes,
  type OsmTags,
} from '@tilda-geo/bicycle-infrastructure'
import { TILDA_LABELS, categoryLabel, gapTags, gapWriteKey } from '../src/index.ts'

const WAYS: OsmTags[] = [
  { highway: 'residential', 'cycleway:right': 'yes' },
  { highway: 'residential', 'cycleway:both': 'yes' },
  { highway: 'residential', 'cycleway:left': 'yes', 'cycleway:right': 'lane' },
  { highway: 'residential', 'cycleway:right': 'lane' },
  { highway: 'residential', 'sidewalk:right': 'yes', 'sidewalk:right:bicycle': 'yes' },
  { highway: 'cycleway' },
  { highway: 'cycleway', cycleway: 'track' },
  { highway: 'path', bicycle: 'designated', foot: 'designated' },
  { highway: 'footway', bicycle: 'yes' },
]

function gapsOf(tags: OsmTags) {
  const results = processBikelanes(tags)
  return analyzeCategoryGaps(tags, results).flatMap((gap, index) =>
    gap.missing.map((missing) => ({
      gap: missing,
      result: results[index]!,
      category: gap.category,
    })),
  )
}

describe('gapWriteKey', () => {
  it('writes the keys of a road side with the side', () => {
    const [first] = gapsOf({ highway: 'residential', 'cycleway:right': 'lane' })
    expect(first!.gap.key).toBe('lane')
    expect(gapWriteKey(first!.gap, first!.result)).toBe('cycleway:right:lane')
  })

  it('writes the gap "cycleway" of a road side as the side itself, not cycleway:right:cycleway', () => {
    const gaps = gapsOf({ highway: 'residential', 'cycleway:right': 'yes' })
    const presence = gaps.filter((g) => g.gap.key === 'cycleway')
    expect(presence.length).toBeGreaterThan(0)
    for (const { gap, result } of presence) expect(gapWriteKey(gap, result)).toBe('cycleway:right')
    expect(gapTags(presence[0]!.gap, presence[0]!.result, 'track')).toEqual({
      'cycleway:right': 'track',
    })
  })

  it('writes bare keys for a way of its own', () => {
    const gaps = gapsOf({ highway: 'cycleway' })
    const keys = new Set(gaps.map(({ gap, result }) => gapWriteKey(gap, result)))
    expect(keys).toEqual(new Set(['segregated', 'traffic_sign', 'cycleway', 'bicycle']))
  })

  it('every answer to every gap of the sample ways writes a tag TILDA reads', () => {
    let answers = 0
    for (const tags of WAYS) {
      for (const { gap, result, category } of gapsOf(tags)) {
        for (const value of gap.values) {
          const written = gapTags(gap, result, value)
          const [key] = Object.keys(written)
          const next = { ...tags, ...written }
          const after = processBikelanes(next).find((r) => r._side === result._side)
          expect(after, `${key}=${value}`).toBeDefined()
          answers += 1
          // `segregated` and `bicycle` need more tags (foot, bicycle) to settle the category
          if (gap.key === 'segregated' || gap.key === 'bicycle') continue
          // the core offers the gaps of a cycleway on `highway=path` too, but only reads some there
          if (tags.highway === 'path') continue
          expect(after!.category, `${JSON.stringify(tags)} ${key}=${value}`).not.toBe(category)
          // the written key is the one the side reads: the same tags without the side's prefix would not
          if (result._side !== 'self')
            expect(key!.startsWith(`${result._prefix}:${result._side}`)).toBe(true)
        }
      }
    }
    expect(answers).toBeGreaterThan(40)
  })
})

describe('labels of the base categories', () => {
  it('every category a gap unlocks has a label', () => {
    const unlocked = new Set<string>()
    for (const spec of CATEGORY_SPECS) {
      for (const gap of spec.gapDiscriminators ?? []) {
        if (gap.unlocksCategory && !gap.unlocksCategory.startsWith('_')) {
          unlocked.add(gap.unlocksCategory)
        }
      }
    }
    expect(unlocked.size).toBeGreaterThanOrEqual(4)
    for (const id of unlocked) {
      expect(categoryLabel(id, TILDA_LABELS.de), id).toBeTruthy()
    }
  })

  it('names them like the legend of tilda-geo', () => {
    expect(categoryLabel('footAndCyclewaySegregated', TILDA_LABELS.de)).toBe(
      'Getrennter Rad- und Gehweg',
    )
    expect(categoryLabel('cycleway', TILDA_LABELS.de)).toBe('Getrennter Radweg')
  })

  it('the gaps of the sample ways unlock labelled categories', () => {
    for (const tags of WAYS) {
      for (const { gap } of gapsOf(tags)) {
        if (gap.unlocksCategory) {
          expect(
            categoryLabel(gap.unlocksCategory, TILDA_LABELS.de),
            gap.unlocksCategory,
          ).toBeTruthy()
        }
      }
    }
  })
})
