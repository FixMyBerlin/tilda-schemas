import { describe, expect, it } from 'bun:test'
import type { OsmTags } from '@tilda-geo/bicycle-infrastructure'
import { parseTagsParam, serializeTagsParam } from './tagsParam.ts'

describe('tags in the URL', () => {
  it('keeps plain links readable', () => {
    expect(serializeTagsParam({ highway: 'cycleway', bicycle: 'designated' })).toBe(
      'highway=cycleway;bicycle=designated',
    )
    expect(serializeTagsParam({ surface: 'asphalt;paving_stones' })).toBe(
      'surface=asphalt;paving_stones',
    )
    expect(parseTagsParam('traffic_sign=DE:240;1022-10;segregated=no')).toEqual({
      traffic_sign: 'DE:240;1022-10',
      segregated: 'no',
    })
  })

  it('escapes a ; that would start a new tag', () => {
    expect(serializeTagsParam({ note: 'erst;dann x=y' })).toBe('note=erst\\;dann x=y')
  })

  it.each<OsmTags>([
    { surface: 'asphalt;paving_stones' },
    { traffic_sign: 'DE:240;1022-10', segregated: 'no' },
    { note: 'erst;dann x=y', highway: 'path' },
    { description: 'a;b=c;d' },
    { note: 'back\\slash; and \\;' },
    { note: 'a=b', name: 'X' },
    { note: ';=;' },
  ])('round trip %p', (tags) => {
    expect(parseTagsParam(serializeTagsParam(tags))).toEqual(tags)
  })
})
