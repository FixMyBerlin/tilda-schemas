import { describe, expect, it } from 'bun:test'
import { processBikelanes } from '../src/index.ts'
import type { BikelaneResult } from '../src/index.ts'

const bikelane = (tags: Record<string, string>, side: 'self' | 'left' | 'right' = 'self') => {
  const lane = processBikelanes(tags).find((r) => r._side === side)
  if (lane == null) throw new Error(`no ${side} row`)
  return lane as BikelaneResult
}

const surfaces = (tags: Record<string, string>) =>
  Object.fromEntries(
    processBikelanes(tags)
      .filter((r) => r._side !== 'self')
      .map((r) => [r._side, r.surface]),
  )

// Cases of tilda-geo roads_bikelanes_roads.test.lua `directional surface` (7acec52af),
// bikelanes only: the roads table and the `description` hints are not part of this package.
describe('bikelane surface: surface:bicycle', () => {
  // https://www.openstreetmap.org/way/840977557 (Grimmstraße)
  it('reads surface and smoothness for bicycles on a Fahrradstraße', () => {
    const lane = bikelane({
      highway: 'residential',
      bicycle_road: 'yes',
      traffic_sign: 'DE:244.1',
      oneway: 'yes',
      surface: 'sett',
      'sett:length': '0.15',
      smoothness: 'bad',
      'surface:bicycle': 'asphalt',
      'smoothness:bicycle': 'good',
    })
    expect(lane.category).toBe('bicycleRoad')
    expect(lane.surface).toBe('asphalt')
    expect(lane.surface_source).toBe('tag')
    expect(lane.smoothness).toBe('good')
    expect(lane.smoothness_source).toBe('tag')
  })

  it('derives the smoothness from surface:bicycle without smoothness:bicycle', () => {
    const lane = bikelane({
      highway: 'residential',
      bicycle_road: 'yes',
      traffic_sign: 'DE:244.1',
      surface: 'sett',
      smoothness: 'bad',
      'surface:bicycle': 'asphalt',
    })
    expect(lane.surface).toBe('asphalt')
    expect(lane.smoothness).toBe('good')
    expect(lane.smoothness_source).toBe('surface_to_smoothness')
  })

  it('keeps surface and smoothness of the way without surface:bicycle', () => {
    const lane = bikelane({
      highway: 'residential',
      bicycle_road: 'yes',
      traffic_sign: 'DE:244.1',
      surface: 'sett',
      smoothness: 'bad',
    })
    expect(lane.surface).toBe('sett')
    expect(lane.smoothness).toBe('bad')
  })

  it('ignores a surface:bicycle outside the allowlist', () => {
    const lane = bikelane({
      highway: 'residential',
      bicycle_road: 'yes',
      traffic_sign: 'DE:244.1',
      surface: 'asphalt',
      'surface:bicycle': '<script>',
    })
    expect(lane.surface).toBe('asphalt')
    expect(lane.surface_source).toBe('tag')
  })

  it('reads surface:bicycle on a pedestrian area', () => {
    const lane = bikelane({
      highway: 'pedestrian',
      bicycle: 'yes',
      surface: 'paving_stones',
      'surface:bicycle': 'asphalt',
    })
    expect(lane.category).toBe('pedestrianAreaBicycleYes')
    expect(lane.surface).toBe('asphalt')
    expect(lane.smoothness).toBe('good')
  })

  it('reads surface:bicycle on a segregated path', () => {
    const lane = bikelane({
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'yes',
      traffic_sign: 'DE:241-30',
      surface: 'paving_stones',
      'surface:bicycle': 'asphalt',
    })
    expect(lane.surface).toBe('asphalt')
    expect(lane.surface_source).toBe('tag')
  })

  it('reads surface:bicycle on a cycleway of its own', () => {
    const lane = bikelane({
      highway: 'cycleway',
      is_sidepath: 'yes',
      surface: 'paving_stones',
      smoothness: 'intermediate',
      'surface:bicycle': 'asphalt',
    })
    expect(lane.category).toBe('cycleway_adjoining')
    expect(lane.surface).toBe('asphalt')
    expect(lane.smoothness).toBe('good')
  })

  it('reads surface:bicycle on a footway with bicycle=yes (subcategories inherit bicycleSurface)', () => {
    const lane = bikelane({
      highway: 'footway',
      bicycle: 'yes',
      is_sidepath: 'no',
      traffic_sign: 'DE:239,1022-10',
      surface: 'sett',
      'surface:bicycle': 'asphalt',
    })
    expect(lane.category).toBe('footwayBicycleYes_isolated')
    expect(lane.surface).toBe('asphalt')
  })

  it('reads surface:bicycle of the road on a shared lane', () => {
    // sharedMotorVehicleLane: a `highway=cycleway` + `cycleway=shared_lane` side of the road
    const lane = bikelane(
      {
        highway: 'residential',
        surface: 'sett',
        'surface:bicycle': 'asphalt',
        'cycleway:right': 'shared_lane',
      },
      'right',
    )
    expect(lane.category).toBe('sharedMotorVehicleLane')
    expect(lane.surface).toBe('asphalt')
    expect(lane.surface_source).toBe('parent_highway_tag')
    expect(lane.smoothness).toBe('good')
  })
})

describe('bikelane surface: lanes on the road', () => {
  // https://www.openstreetmap.org/way/4692264 (Körtestraße)
  it('reads surface:bicycle of the road on a Schutzstreifen without own surface', () => {
    const lane = bikelane(
      {
        highway: 'residential',
        surface: 'sett',
        'surface:bicycle': 'asphalt',
        'cycleway:right': 'lane',
        'cycleway:right:lane': 'advisory',
      },
      'right',
    )
    expect(lane.category).toBe('cyclewayOnHighway_advisory')
    expect(lane.surface).toBe('asphalt')
    expect(lane.surface_source).toBe('parent_highway_tag')
    // The smoothness of the sett road does not apply to the asphalt strip
    expect(lane.smoothness).toBe('good')
    expect(lane.smoothness_source).toBe('parent_highway_surface_to_smoothness')
  })

  it('prefers cycleway:<side>:surface of a lane over surface:bicycle of the road', () => {
    const lanes = {
      highway: 'residential',
      surface: 'sett',
      'surface:bicycle': 'asphalt',
      'cycleway:left': 'lane',
      'cycleway:left:lane': 'advisory',
      'cycleway:left:surface': 'concrete',
    }
    const lane = bikelane(lanes, 'left')
    expect(lane.surface).toBe('concrete')
    expect(lane.surface_source).toBe('tag')
  })

  it('reads cycleway:left:surface of the lane, not the road (Körtestraße)', () => {
    const lane = bikelane(
      {
        highway: 'residential',
        surface: 'sett',
        'surface:bicycle': 'asphalt',
        'cycleway:left': 'lane',
        'cycleway:left:lane': 'advisory',
        'cycleway:left:surface': 'asphalt',
      },
      'left',
    )
    expect(lane.surface).toBe('asphalt')
    expect(lane.surface_source).toBe('tag')
  })

  it('reads surface:<side> of the road on a bus lane', () => {
    const lane = bikelane(
      {
        highway: 'secondary',
        surface: 'sett',
        'surface:right': 'asphalt',
        'cycleway:right': 'share_busway',
      },
      'right',
    )
    expect(lane.category).toBe('sharedBusLaneBusWithBike')
    expect(lane.surface).toBe('asphalt')
    expect(lane.surface_source).toBe('parent_highway_tag_directional')
    expect(lane.smoothness).toBe('good')
  })

  it('reads surface:forward|backward of the road for the right and left lane', () => {
    expect(
      surfaces({
        highway: 'residential',
        'surface:forward': 'asphalt',
        'surface:backward': 'sett',
        'cycleway:both': 'lane',
        'cycleway:both:lane': 'advisory',
      }),
    ).toEqual({ right: 'asphalt', left: 'sett' })
  })

  it('reads the direction values only on roads without oneway', () => {
    const tags = {
      highway: 'residential',
      surface: 'sett',
      'surface:forward': 'asphalt',
      'surface:backward': 'asphalt',
      'cycleway:right': 'lane',
      'cycleway:right:lane': 'advisory',
    }
    const twoWay = bikelane(tags, 'right')
    expect(twoWay.surface).toBe('asphalt')
    expect(twoWay.surface_source).toBe('parent_highway_tag_directional')
    // On a oneway road the direction values do not name a half of the road
    const oneway = bikelane({ ...tags, oneway: 'yes' }, 'right')
    expect(oneway.surface).toBe('sett')
    expect(oneway.surface_source).toBe('parent_highway_tag')
  })

  it('prefers the side value over the direction value and surface:bicycle:<side> over both', () => {
    const tags = {
      highway: 'residential',
      surface: 'sett',
      'surface:right': 'concrete',
      'surface:forward': 'asphalt',
      'cycleway:right': 'lane',
      'cycleway:right:lane': 'advisory',
    }
    expect(bikelane(tags, 'right').surface).toBe('concrete')
    expect(bikelane({ ...tags, 'surface:bicycle:forward': 'paving_stones' }, 'right').surface).toBe(
      'paving_stones',
    )
  })

  it('takes the smoothness:bicycle of the road for a lane with a directional value', () => {
    const lane = bikelane(
      {
        highway: 'residential',
        surface: 'sett',
        smoothness: 'bad',
        'surface:right': 'asphalt',
        'smoothness:bicycle': 'excellent',
        'cycleway:right': 'lane',
        'cycleway:right:lane': 'advisory',
      },
      'right',
    )
    expect(lane.surface).toBe('asphalt')
    expect(lane.smoothness).toBe('excellent')
  })
})

describe('bikelane surface: directional and side values of the way', () => {
  // https://www.openstreetmap.org/way/4475759 (Mehringplatz)
  it('keeps surface on a shared path when it is tagged', () => {
    const lane = bikelane({
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'no',
      surface: 'paving_stones',
      'surface:left': 'asphalt',
      'surface:right': 'paving_stones',
    })
    expect(lane.category).toBe('footAndCyclewayShared_adjoiningOrIsolated')
    expect(lane.surface).toBe('paving_stones')
    expect(lane.surface_source).toBe('tag')
  })

  it('takes the worse side value on a bikelane without surface', () => {
    const lane = bikelane({
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'no',
      'surface:left': 'asphalt',
      'surface:right': 'sett',
    })
    expect(lane.surface).toBe('sett')
    expect(lane.surface_source).toBe('tag_directional')
    expect(lane.smoothness).toBe('bad')
  })

  it('keeps the tagged smoothness on a bikelane that takes the worse side value', () => {
    const lane = bikelane({
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'no',
      smoothness: 'good',
      'surface:left': 'asphalt',
      'surface:right': 'sett',
    })
    expect(lane.surface).toBe('sett')
    expect(lane.smoothness).toBe('good')
    expect(lane.smoothness_source).toBe('tag')
  })

  it('uses the side values when surface is not in the allowlist', () => {
    const lane = bikelane({
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'no',
      surface: 'not_a_surface',
      'surface:left': 'asphalt',
      'surface:right': 'sett',
    })
    expect(lane.surface).toBe('sett')
    expect(lane.surface_source).toBe('tag_directional')
  })

  it('takes the first value of a half of the way when side and direction are both tagged', () => {
    // surface:right and surface:forward name the same half; only the first valid one counts
    const lane = bikelane({
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'no',
      'surface:right': 'asphalt',
      'surface:forward': 'sett',
    })
    expect(lane.surface).toBe('asphalt')
  })

  it('takes the worse of surface:bicycle:<side> values', () => {
    const lane = bikelane({
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'no',
      'surface:bicycle:left': 'asphalt',
      'surface:bicycle:right': 'gravel',
    })
    expect(lane.surface).toBe('gravel')
    expect(lane.surface_source).toBe('tag_directional')
  })

  it('ignores values outside the allowlist', () => {
    const lane = bikelane({
      highway: 'path',
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'no',
      surface: 'asphalt',
      'surface:left': '<script>',
    })
    expect(lane.surface).toBe('asphalt')
    expect(lane.surface_source).toBe('tag')
  })

  it('does not read directional values on a lane on the road (own surface is cycleway:<side>:surface)', () => {
    const lane = bikelane(
      {
        highway: 'residential',
        'cycleway:right': 'lane',
        'cycleway:right:lane': 'advisory',
        'cycleway:right:surface:left': 'sett',
      },
      'right',
    )
    expect(lane.surface).toBeNull()
  })
})
