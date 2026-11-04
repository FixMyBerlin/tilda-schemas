import { describe, expect, it } from 'bun:test'
import {
  listTargetCategories,
  processBikelanes,
  type BikelaneResult,
} from '@tilda-geo/bicycle-infrastructure'
import {
  isRoad,
  reminders,
  requiredAttributes,
  roadAttributes,
  tildaQaState,
  type OsmTags,
  type RequiredAttribute,
} from '../src/index.ts'
import { radnetzBerlin } from '../src/profiles/radnetz-berlin.ts'
import { tildaGeo } from '../src/profiles/tilda-geo.ts'

const SEGREGATED: OsmTags = {
  highway: 'path',
  bicycle: 'designated',
  foot: 'designated',
  segregated: 'yes',
  is_sidepath: 'yes',
}

function list(tags: OsmTags, profile = tildaGeo, side = 'self', targetCategory?: string) {
  const result = processBikelanes(tags).find((r) => r._side === side)!
  return requiredAttributes(result, tags, { profile, targetCategory })
}

const ids = (attributes: RequiredAttribute[]) => attributes.map((a) => a.id)

describe('profile tilda-geo', () => {
  it('has an id and feeds nothing', () => {
    expect(tildaGeo.id).toBe('tilda-geo')
    expect(tildaGeo.feeds).toEqual({})
    expect(tildaGeo.reminders).toEqual([])
    expect(tildaGeo.damageSigns).toEqual([])
  })

  it('a segregated path has one width and one colour for the whole way', () => {
    expect(ids(list(SEGREGATED))).toContain('width')
    expect(ids(list(SEGREGATED))).not.toContain('cycleway_width')
    expect(ids(list(SEGREGATED, radnetzBerlin))).toContain('cycleway_width')
    expect(ids(list(SEGREGATED, radnetzBerlin))).not.toContain('width')
    const colour = list(SEGREGATED).find((a) => a.id === 'surface_colour')!
    expect(colour.key).toBe('surface:colour')
  })

  it('asks for the width source of an edited width, like TILDA reads it', () => {
    const tags = { highway: 'cycleway', width: '2' }
    const result = processBikelanes(tags)[0]!
    const attributes = requiredAttributes(result, tags, {
      profile: tildaGeo,
      edited: new Set(['width']),
    })
    expect(ids(attributes)).toContain('source_width')
    expect(attributes.find((a) => a.id === 'source_width')!.options).toEqual([])
  })

  it('has no attribute the Radnetz profile does not have, except the whole-way width', () => {
    const extra = new Set<string>()
    const fewer = new Set<string>()
    for (const tags of [
      SEGREGATED,
      { highway: 'cycleway' },
      { highway: 'footway', bicycle: 'yes' },
      { highway: 'residential', 'cycleway:right': 'lane', 'cycleway:right:lane': 'exclusive' },
      {
        highway: 'residential',
        'cycleway:right': 'lane',
        'cycleway:right:separation:left': 'bollard',
      },
      { highway: 'residential', bicycle_road: 'yes', oneway: 'yes' },
    ] as OsmTags[]) {
      for (const result of processBikelanes(tags)) {
        const a = new Set(ids(requiredAttributes(result, tags, { profile: tildaGeo })))
        const b = new Set(ids(requiredAttributes(result, tags, { profile: radnetzBerlin })))
        for (const id of a) if (!b.has(id)) extra.add(id)
        for (const id of b) if (!a.has(id)) fewer.add(id)
      }
    }
    expect([...extra]).toEqual(['width'])
    expect([...fewer]).toEqual(['cycleway_width'])
  })

  it('a road list has no dual_carriageway', () => {
    const tags = { highway: 'residential', oneway: 'yes' }
    expect(isRoad(tags)).toBe(true)
    expect(ids(roadAttributes(tags, { profile: radnetzBerlin }))).toContain('dual_carriageway')
    expect(ids(roadAttributes(tags, { profile: tildaGeo }))).not.toContain('dual_carriageway')
    expect(ids(roadAttributes(tags, { profile: tildaGeo }))).toEqual([
      'oneway',
      'oneway_bicycle',
      'surface',
      'cycleway',
    ])
  })

  it('has attributes for every category, and none feeds an infraVelo attribute', () => {
    const tags = { highway: 'residential', 'cycleway:right': 'track' } as OsmTags
    const result: BikelaneResult = processBikelanes(tags)[0]!
    for (const category of listTargetCategories()) {
      for (const attribute of requiredAttributes(result, tags, {
        profile: tildaGeo,
        targetCategory: category,
      })) {
        expect(attribute.feeds).toEqual([])
      }
    }
    // the link is skipped in the Radnetz dataset only
    const link = requiredAttributes(result, tags, {
      profile: tildaGeo,
      targetCategory: 'cyclewayLink',
    })
    expect(link.length).toBeGreaterThan(0)
    expect(
      requiredAttributes(result, tags, { profile: radnetzBerlin, targetCategory: 'cyclewayLink' }),
    ).toEqual([])
  })

  it('offers the signs that settle the category, and none', () => {
    const shared = list(
      { highway: 'path', bicycle: 'designated', foot: 'designated', segregated: 'no' },
      tildaGeo,
      'self',
      'footAndCyclewayShared_isolated',
    ).find((a) => a.id === 'traffic_sign')!
    expect(shared.options).toEqual(['DE:240', 'none'])
    const lane = list(
      { highway: 'residential', 'cycleway:right': 'lane' },
      tildaGeo,
      'right',
      'cyclewayOnHighway_exclusive',
    ).find((a) => a.id === 'traffic_sign')!
    expect(lane.options).toEqual(['none'])
  })

  it('has no reminders and the QA state works', () => {
    const tags = { highway: 'cycleway', 'cycleway:right': 'track' } as OsmTags
    const result = processBikelanes({ highway: 'residential', 'cycleway:right': 'track' })[0]!
    expect(reminders(result, tags, tildaGeo)).toEqual([])
    expect(tildaQaState({ highway: 'cycleway' }, tildaGeo)).toMatchObject({ state: 'unclear' })
    const complete = tildaQaState(
      {
        highway: 'cycleway',
        is_sidepath: 'yes',
        traffic_sign: 'DE:237',
        width: '2',
        surface: 'asphalt',
        oneway: 'no',
        'surface:colour': 'no',
      },
      tildaGeo,
    )
    expect(complete?.state).toBe('complete')
  })
})
