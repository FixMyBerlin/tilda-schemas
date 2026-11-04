import { describe, expect, it } from 'bun:test'
import { listTargetCategories, processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import {
  CATEGORY_GROUPS,
  TILDA_LABELS,
  categoryGroupLabel,
  categoryLabel,
  groupCategories,
  isLabelLanguage,
  reminders,
  requiredAttributes,
  roadAttributes,
  type OsmTags,
  type RequirementsProfile,
} from '../src/index.ts'
import { DAMAGE_SIGNS, radnetzBerlin } from '../src/profiles/radnetz-berlin.ts'

const resultFor = (tags: OsmTags, side: 'self' | 'left' | 'right') =>
  processBikelanes(tags).find((r) => r._side === side)!

describe('parking=no gives no traffic mode (LUA wins)', () => {
  it('on a bicycle road: nothing derived from parking:*=no', () => {
    const tags = { highway: 'residential', bicycle_road: 'yes', 'parking:both': 'no' }
    const result = resultFor(tags, 'self')
    expect(result.traffic_mode_left).toBeNull()
    const attributes = requiredAttributes(result, tags, { profile: radnetzBerlin })
    const left = attributes.find((a) => a.id === 'traffic_mode_left')!
    expect(left.state).toBe('assumed')
    expect(left.source).toBeUndefined()
  })

  it('other parking still gives parking', () => {
    const tags = { highway: 'residential', bicycle_road: 'yes', 'parking:both': 'lane' }
    const attributes = requiredAttributes(resultFor(tags, 'self'), tags, { profile: radnetzBerlin })
    const left = attributes.find((a) => a.id === 'traffic_mode_left')!
    expect(left).toMatchObject({
      state: 'inherited',
      tilda: 'parking',
      source: 'parking:both=lane',
    })
  })
})

describe('profiles', () => {
  const lane = {
    highway: 'secondary',
    'cycleway:right': 'lane',
    'cycleway:right:lane': 'exclusive',
  }

  it('every attribute of the engine feeds a dataset attribute in the Radnetz profile', () => {
    const cases: [OsmTags, 'self' | 'left' | 'right', string?][] = [
      [lane, 'right'],
      [{ highway: 'cycleway', cycleway: 'track', is_sidepath: 'yes' }, 'self'],
      [{ highway: 'cycleway' }, 'self', 'cyclewayOnHighwayProtected'],
      [{ highway: 'path', bicycle: 'designated', foot: 'designated', segregated: 'yes' }, 'self'],
      [{ highway: 'cycleway', segregated: 'yes', traffic_sign: 'DE:241-30' }, 'self'],
      [{ highway: 'residential', bicycle_road: 'yes' }, 'self'],
    ]
    for (const [tags, side, target] of cases) {
      const attributes = requiredAttributes(resultFor(tags, side), tags, {
        profile: radnetzBerlin,
        targetCategory: target,
      })
      expect(attributes.length).toBeGreaterThan(0)
      for (const attribute of attributes) {
        expect(attribute.feeds.length, `${attribute.ruleSet}:${attribute.id}`).toBeGreaterThan(0)
      }
    }
    for (const attribute of roadAttributes(
      { highway: 'residential' },
      { profile: radnetzBerlin },
    )) {
      expect(attribute.feeds.length, `${attribute.ruleSet}:${attribute.id}`).toBeGreaterThan(0)
    }
  })

  it('a profile of another dataset changes feeds, signs, sources and reminders', () => {
    const other: RequirementsProfile = {
      id: 'other',
      feeds: { 'common:width': ['breite_m'] },
      trafficSignOptions: () => ['DE:237'],
      damageSigns: [],
      widthSourceOptions: ['survey'],
      settLengthOptions: [],
      bufferOptions: [],
      skipCategories: [],
      reminders: [{ id: 'check_gate', applies: (category) => category.startsWith('cycleway_') }],
    }
    const attributes = requiredAttributes(resultFor(lane, 'right'), lane, { profile: other })
    expect(attributes.find((a) => a.id === 'width')!.feeds).toEqual(['breite_m'])
    expect(attributes.find((a) => a.id === 'surface')!.feeds).toEqual([])
    expect(attributes.find((a) => a.id === 'traffic_sign')!.options).toEqual(['DE:237'])
    const track = { highway: 'cycleway', cycleway: 'track', is_sidepath: 'yes' }
    expect(reminders(resultFor(track, 'self'), track, other)).toEqual(['check_gate'])
  })

  it('options come from the sanitizers of the core package', () => {
    const tags = { highway: 'cycleway', cycleway: 'track', is_sidepath: 'yes' }
    const attributes = requiredAttributes(resultFor(tags, 'self'), tags, {
      profile: radnetzBerlin,
      targetCategory: 'cyclewayOnHighwayProtected',
    })
    const separation = attributes.find((a) => a.id === 'separation_left')
    // not asked before the traffic modes are set, so look at the rule with them set
    expect(separation).toBeUndefined()
    const modes = { ...tags, 'traffic_mode:left': 'no', 'traffic_mode:right': 'no' }
    const withModes = requiredAttributes(resultFor(modes, 'self'), modes, {
      profile: radnetzBerlin,
      targetCategory: 'cyclewayOnHighwayProtected',
    })
    const options = withModes.find((a) => a.id === 'separation_left')!.options
    expect(options).toContain('bollard')
    expect(options).not.toContain('kerb;bollard')
    expect(options).not.toContain('yes')
    expect(withModes.find((a) => a.id === 'marking_left')!.options).toContain('no')
  })

  it('the Radnetz profile offers its damage signs next to the category signs', () => {
    const tags = { highway: 'cycleway', cycleway: 'track', is_sidepath: 'yes' }
    const options = requiredAttributes(resultFor(tags, 'self'), tags, {
      profile: radnetzBerlin,
    }).find((a) => a.id === 'traffic_sign')!.options
    expect(options).toEqual(['DE:237', 'none', ...DAMAGE_SIGNS])
  })

  it('cyclewayLink and categories without infrastructure have no requirements', () => {
    const link = { highway: 'cycleway' }
    expect(
      requiredAttributes(resultFor(link, 'self'), link, {
        profile: radnetzBerlin,
        targetCategory: 'cyclewayLink',
      }),
    ).toEqual([])
  })
})

describe('labels', () => {
  it('has a German label for every target category', () => {
    for (const category of listTargetCategories()) {
      expect(categoryLabel(category, TILDA_LABELS.de), category).toEqual(expect.any(String))
    }
  })

  it('takes the label map as argument and says nothing for unknown categories', () => {
    expect(categoryLabel('cycleway_adjoining', { 'category=cycleway_adjoining': 'Track' })).toBe(
      'Track',
    )
    expect(categoryLabel('nope', TILDA_LABELS.de)).toBeUndefined()
    expect(isLabelLanguage('de')).toBe(true)
    expect(isLabelLanguage('fr')).toBe(false)
    expect(categoryGroupLabel('track', 'de')).toBe('Radwege')
  })

  it('sorts categories into groups, the rest into other', () => {
    const grouped = groupCategories(['bicycleRoad', 'cycleway_adjoining', 'something_new'])
    expect(grouped.map((g) => g.id)).toEqual(['track', 'bicycle_road', 'other'])
    expect(grouped[2]!.categories).toEqual(['something_new'])
    const known = CATEGORY_GROUPS.flatMap((g) => g.categories)
    // every target the core offers is in a group (otherwise it ends up in "other")
    const missing = listTargetCategories().filter((c) => !known.includes(c))
    expect(missing).toEqual([])
  })
})
