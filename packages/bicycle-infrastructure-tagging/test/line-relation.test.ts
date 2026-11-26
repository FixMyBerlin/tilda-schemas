import { describe, expect, it } from 'bun:test'
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import {
  applyTagFix,
  lineRelationToRoad,
  optionMeaningText,
  pickSidepathRoad,
  renderMessage,
  requiredAttributes,
  sidepathDirectionFindings,
  validateTags,
  type LonLat,
  type OsmTags,
  type WayGeometry,
} from '../src/index.ts'
import { radnetzBerlin } from '../src/profiles/radnetz-berlin.ts'

// A road drawn eastwards, ~135 m; north of it is its left side
const WEST = 13.4
const EAST = 13.402
const LAT = 52.5
const METER = 1 / 111_195

const line = (offsetMeters: number, from = WEST, to = EAST): LonLat[] => [
  [from, LAT + offsetMeters * METER],
  [to, LAT + offsetMeters * METER],
]
const road = (tags: OsmTags = {}, offset = 0): WayGeometry => ({
  tags: { highway: 'secondary', ...tags },
  coords: line(offset),
})

describe('lineRelationToRoad', () => {
  it('right of a two-way road: drawn with the traffic or against it', () => {
    expect(lineRelationToRoad(line(-8), road())).toEqual({ side: 'right', line: 'with_traffic' })
    expect(lineRelationToRoad(line(-8, EAST, WEST), road())).toEqual({
      side: 'right',
      line: 'against_traffic',
    })
  })

  it('left of a two-way road: the traffic runs against the road line', () => {
    expect(lineRelationToRoad(line(8, EAST, WEST), road())).toEqual({
      side: 'left',
      line: 'with_traffic',
    })
    expect(lineRelationToRoad(line(8), road())).toEqual({ side: 'left', line: 'against_traffic' })
  })

  it('no answer: too far, on the road, across it, too short, at a roundabout', () => {
    expect(lineRelationToRoad(line(-30), road())).toBeUndefined()
    expect(lineRelationToRoad(line(0), road())).toBeUndefined()
    const across: LonLat[] = [
      [13.401, LAT - 20 * METER],
      [13.401, LAT + 20 * METER],
    ]
    expect(lineRelationToRoad(across, road())).toBeUndefined()
    expect(lineRelationToRoad(line(-8, WEST, WEST + 10 * METER * 1.65), road())).toBeUndefined()
    expect(lineRelationToRoad(line(-8), road({ junction: 'roundabout' }))).toBeUndefined()
  })

  it('a one-way road: its right side counts, its left side (median, contraflow) does not', () => {
    const oneway = road({ oneway: 'yes' })
    expect(lineRelationToRoad(line(-8, EAST, WEST), oneway)?.line).toBe('against_traffic')
    expect(lineRelationToRoad(line(8), oneway)).toBeUndefined()
    // oneway=-1: the traffic runs westwards, its left is the line's right
    const reversed = road({ oneway: '-1' })
    expect(lineRelationToRoad(line(8, EAST, WEST), reversed)).toEqual({
      side: 'left',
      line: 'with_traffic',
    })
    expect(lineRelationToRoad(line(-8), reversed)).toBeUndefined()
  })
})

describe('pickSidepathRoad', () => {
  // the path lies 12 m south of the main road; a service road lies between them, 4 m from the path
  const path = line(-12)
  const service = road({ highway: 'service' }, -8)

  it('takes the nearest road when no road maps the side as separate', () => {
    const main = road()
    expect(pickSidepathRoad(path, [main, service])).toBe(service)
  })

  it('prefers a road with cycleway:<side>=separate, then sidewalk:<side>=separate', () => {
    const cycleway = road({ 'cycleway:right': 'separate' })
    expect(pickSidepathRoad(path, [service, cycleway])).toBe(cycleway)
    const both = road({ 'cycleway:both': 'separate' })
    expect(pickSidepathRoad(path, [service, both])).toBe(both)
    const sidewalk = road({ 'sidewalk:right': 'separate' })
    expect(pickSidepathRoad(path, [service, sidewalk])).toBe(sidewalk)
    expect(pickSidepathRoad(path, [sidewalk, cycleway])).toBe(cycleway)
    // separate on the other side does not count
    expect(pickSidepathRoad(path, [service, road({ 'cycleway:left': 'separate' })])).toBe(service)
  })

  it('skips roads the way does not run along', () => {
    expect(pickSidepathRoad(path, [road({}, -60)])).toBeUndefined()
  })
})

describe('sidepath_line_against_traffic', () => {
  const cycleway = { highway: 'cycleway', oneway: 'yes', is_sidepath: 'yes' }

  it('finds yes against the traffic, and the fix only reverses the way', () => {
    const way = { tags: cycleway, coords: line(-8, EAST, WEST) }
    const findings = sidepathDirectionFindings(way, [road()])
    expect(findings.map((f) => f.ruleId)).toEqual(['sidepath_line_against_traffic'])
    expect(findings[0]!.keys).toEqual(['oneway'])
    expect(renderMessage(findings[0]!.message, 'de')).toContain('rechten Straßenseite')
    const fix = findings[0]!.fixes[0]!
    expect(fix.reverseWay).toBe(true)
    expect(applyTagFix(cycleway, fix)).toEqual(cycleway)
  })

  it('reads oneway:bicycle on a foot and cycle path', () => {
    const tags = {
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      oneway: 'no',
      'oneway:bicycle': 'yes',
    }
    const findings = sidepathDirectionFindings({ tags, coords: line(8) }, [road()])
    expect(findings[0]?.keys).toEqual(['oneway:bicycle'])
    expect(renderMessage(findings[0]!.message, 'en')).toContain('left side')
  })

  it('nothing with the traffic, for two-way paths, -1, or without the geometry', () => {
    expect(sidepathDirectionFindings({ tags: cycleway, coords: line(-8) }, [road()])).toEqual([])
    const twoWay = { ...cycleway, oneway: 'no' }
    expect(
      sidepathDirectionFindings({ tags: twoWay, coords: line(-8, EAST, WEST) }, [road()]),
    ).toEqual([])
    const reversed = { ...cycleway, oneway: '-1' }
    expect(
      sidepathDirectionFindings({ tags: reversed, coords: line(-8, EAST, WEST) }, [road()]),
    ).toEqual([])
    expect(
      validateTags(cycleway, { profile: 'radnetz-berlin' }).map((f) => f.ruleId),
    ).not.toContain('sidepath_line_against_traffic')
  })
})

describe('oneway meaning with the line relation', () => {
  const tags = { highway: 'cycleway', oneway: 'yes' }
  const meaning = (line?: 'with_traffic' | 'against_traffic') => {
    const self = processBikelanes(tags).find((r) => r._side === 'self')!
    const oneway = requiredAttributes(self, tags, {
      profile: radnetzBerlin,
      lineRelation: line && { side: 'right', line },
    }).find((a) => a.id === 'oneway')!
    return optionMeaningText(oneway, 'yes', 'de')?.label
  }

  it('says whether the line runs with the traffic alongside', () => {
    expect(meaning()).toBe('nur in Linienrichtung')
    expect(meaning('with_traffic')).toBe('nur in Linienrichtung – mit dem Verkehr daneben')
    expect(meaning('against_traffic')).toBe('nur in Linienrichtung – gegen den Verkehr daneben')
  })
})
