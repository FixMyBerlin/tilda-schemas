import { describe, expect, it } from 'bun:test'
import { processBikelanes } from '../src/index.ts'

/** `side/prefix:category:lifecycle` of the results with infrastructure */
const lifecycles = (tags: Record<string, string>) =>
  processBikelanes(tags)
    .filter((r) => r._infrastructureExists)
    .map((r) => `${r._side}/${r._prefix}:${r.category}:${r.lifecycle}`)

// Cases of tilda-geo bikelanes_lifecycle.test.lua and transform_lifecycle_tags.test.lua (08b1428b5)
describe('lifecycle', () => {
  it('reads temporary=yes on a way of its own', () => {
    expect(lifecycles({ highway: 'cycleway', is_sidepath: 'yes', temporary: 'yes' })).toEqual([
      'self/null:cycleway_adjoining:temporary',
    ])
  })

  it('gives a road side the lifecycle of its road', () => {
    expect(
      lifecycles({ highway: 'secondary', temporary: 'yes', 'cycleway:right': 'lane' }),
    ).toEqual(['right/cycleway:cyclewayOnHighway_advisoryOrExclusive:temporary'])
  })

  it('reads cycleway:<side>:temporary=yes for that side only', () => {
    expect(
      lifecycles({
        highway: 'secondary',
        'cycleway:left': 'lane',
        'cycleway:right': 'lane',
        'cycleway:right:temporary': 'yes',
      }),
    ).toEqual([
      'left/cycleway:cyclewayOnHighway_advisoryOrExclusive:null',
      'right/cycleway:cyclewayOnHighway_advisoryOrExclusive:temporary',
    ])
  })

  it('reads sidewalk:<side>:temporary=yes', () => {
    expect(
      lifecycles({
        highway: 'secondary',
        'sidewalk:right': 'yes',
        'sidewalk:right:bicycle': 'yes',
        'sidewalk:right:temporary': 'yes',
      }),
    ).toEqual(['right/sidewalk:footwayBicycleYes_adjoining:temporary'])
  })

  it('keeps an existing lifecycle over temporary=yes', () => {
    expect(
      lifecycles({
        highway: 'construction',
        construction: 'cycleway',
        is_sidepath: 'yes',
        temporary: 'yes',
      }),
    ).toEqual(['self/null:cycleway_adjoining:construction'])
  })

  it('reads construction on a way of its own, a road side and a bicycle road', () => {
    expect(
      lifecycles({ highway: 'construction', construction: 'cycleway', is_sidepath: 'yes' }),
    ).toEqual(['self/null:cycleway_adjoining:construction'])
    expect(
      lifecycles({
        highway: 'secondary',
        'construction:cycleway:right': 'lane',
        'cycleway:right:lane': 'exclusive',
      }),
    ).toEqual(['right/cycleway:cyclewayOnHighway_exclusive:construction'])
    expect(lifecycles({ highway: 'residential', 'construction:bicycle_road': 'yes' })).toEqual([
      'self/null:bicycleRoad:construction',
    ])
  })

  it('reads construction:cycleway=* without a side for both sides (4138bc51f)', () => {
    expect(lifecycles({ highway: 'secondary', 'construction:cycleway': 'lane' })).toEqual([
      'left/cycleway:cyclewayOnHighway_advisoryOrExclusive:construction',
      'right/cycleway:cyclewayOnHighway_advisoryOrExclusive:construction',
    ])
  })
})
