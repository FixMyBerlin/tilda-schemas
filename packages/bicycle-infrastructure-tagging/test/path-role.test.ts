import { describe, expect, it } from 'bun:test'
import { partWidthMode, pathRole } from '../src/index.ts'

describe('pathRole', () => {
  it('one line for both modes: highway=path|footway|cycleway with foot and bicycle allowed', () => {
    for (const tags of [
      { highway: 'path', bicycle: 'designated', foot: 'designated' },
      { highway: 'footway', bicycle: 'yes' },
      { highway: 'cycleway', foot: 'permissive' },
    ]) {
      const role = pathRole(tags)
      expect(role.style).toBe('oneLine')
      expect(role.carriesFoot && role.carriesBike).toBe(true)
      expect(role.part).toBeUndefined()
    }
  })

  it('two lines: a cycleway without foot access, a footway without bicycle access', () => {
    expect(pathRole({ highway: 'cycleway', 'traffic_mode:right': 'foot' })).toMatchObject({
      style: 'twoLines',
      carriesBike: true,
      carriesFoot: false,
      part: 'bike',
    })
    expect(pathRole({ highway: 'footway', footway: 'sidewalk' })).toMatchObject({
      style: 'twoLines',
      carriesFoot: true,
      carriesBike: false,
      part: 'foot',
    })
    expect(pathRole({ highway: 'path', bicycle: 'designated' }).part).toBe('bike')
  })

  it('a highway=path carries what is tagged; the category can say it carries both', () => {
    expect(pathRole({ highway: 'path' }).style).toBeUndefined()
    expect(
      pathRole({ highway: 'path' }, { category: 'footAndCyclewayShared_isolated' }),
    ).toMatchObject({ style: 'oneLine', segregated: false })
    expect(pathRole({ highway: 'path', bicycle: 'no', foot: 'yes' }).part).toBe('foot')
  })

  it('segregated: as tagged, else from the category', () => {
    const path = { highway: 'path', bicycle: 'designated', foot: 'designated' }
    expect(pathRole({ ...path, segregated: 'yes' }).segregated).toBe(true)
    expect(pathRole({ ...path, segregated: 'no' }).segregated).toBe(false)
    expect(pathRole(path).segregated).toBeUndefined()
    expect(pathRole(path, { category: 'footAndCyclewaySegregated_adjoining' }).segregated).toBe(
      true,
    )
    // tagged wins over the category
    expect(
      pathRole({ ...path, segregated: 'no' }, { category: 'footAndCyclewaySegregated_adjoining' })
        .segregated,
    ).toBe(false)
  })

  it('road sides are on the centerline', () => {
    const tags = { highway: 'secondary', 'cycleway:right': 'track', 'sidewalk:right': 'yes' }
    expect(pathRole(tags, { side: 'right' })).toMatchObject({
      style: 'centerline',
      carriesBike: true,
      carriesFoot: true,
    })
    expect(pathRole(tags, { side: 'left' }).style).toBeUndefined()
    expect(
      pathRole(
        { highway: 'residential', 'sidewalk:left': 'yes', 'sidewalk:left:bicycle': 'yes' },
        { side: 'left' },
      ).carriesBike,
    ).toBe(true)
  })

  it('areas and roads are no paths', () => {
    expect(pathRole({ highway: 'footway', area: 'yes' }).style).toBeUndefined()
    expect(pathRole({ highway: 'residential', bicycle: 'yes', foot: 'yes' }).style).toBeUndefined()
  })
})

describe('part widths follow pathRole', () => {
  const path = { highway: 'path', bicycle: 'designated', foot: 'designated' }

  it('part widths only with segregated=yes; segregated=no has only width', () => {
    expect(partWidthMode({ ...path, segregated: 'yes' })).toBe('always')
    expect(partWidthMode({ ...path, segregated: 'no' })).toBeUndefined()
    expect(partWidthMode(path)).toBe('optional')
  })

  it('the category decides when segregated is not tagged', () => {
    expect(partWidthMode(path, 'footAndCyclewaySegregated_adjoining')).toBe('always')
    expect(partWidthMode(path, 'footAndCyclewayShared_adjoining')).toBeUndefined()
  })

  it('two lines: no part widths, the width is the cycleway width', () => {
    expect(
      partWidthMode({ highway: 'cycleway', segregated: 'yes', 'traffic_mode:right': 'foot' }),
    ).toBe(undefined)
  })
})
