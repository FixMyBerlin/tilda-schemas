import { describe, expect, it } from 'bun:test'
import { highwayClass, isUnderConstruction } from '../src/index.ts'

describe('highwayClass', () => {
  it('is the class a way under construction will have, as transform_lifecycle_tags.lua reads it', () => {
    const tags = { highway: 'construction', construction: 'tertiary' }
    expect(isUnderConstruction(tags)).toBe(true)
    expect(highwayClass(tags)).toBe('tertiary')
    expect(highwayClass({ highway: 'construction', construction: 'cycleway' })).toBe('cycleway')
  })

  it('is highway otherwise', () => {
    expect(highwayClass({ highway: 'tertiary' })).toBe('tertiary')
    // `construction=yes` names no class: TILDA leaves the way as it is
    const unknown = { highway: 'construction', construction: 'yes' }
    expect(isUnderConstruction(unknown)).toBe(false)
    expect(highwayClass(unknown)).toBe('construction')
    expect(highwayClass({})).toBeUndefined()
  })
})
