import { describe, expect, it } from 'bun:test'
import { listTargetCategories, processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import {
  ATTRIBUTE_HINTS,
  ATTRIBUTE_IDS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_NOTES,
  ATTRIBUTE_STATE_LABELS,
  ATTRIBUTE_STATE_TEXTS,
  QA_STATE_LABELS,
  REMINDER_TEXTS,
  attributeFeedsText,
  attributeLabel,
  attributeNote,
  reminderText,
  reminders,
  requiredAttributes,
  roadAttributes,
  type AttributeState,
  type OsmTags,
  type RequiredAttribute,
} from '../src/index.ts'
import { radnetzBerlin } from '../src/profiles/radnetz-berlin.ts'

const LANGUAGES = ['de', 'en'] as const

/** Ways in many shapes: every attribute, note and hint the engine can produce shows up in some. */
function corpus(): OsmTags[] {
  const ways: OsmTags[] = []
  const bases: OsmTags[] = [
    { highway: 'cycleway' },
    { highway: 'path', bicycle: 'designated', foot: 'designated' },
    { highway: 'path', bicycle: 'designated', foot: 'designated', segregated: 'yes' },
    { highway: 'cycleway', 'traffic_mode:right': 'foot' },
    { highway: 'footway', bicycle: 'yes' },
    { highway: 'residential' },
    { highway: 'residential', oneway: 'yes' },
    { highway: 'residential', oneway: 'yes', 'oneway:bicycle': 'no' },
    { highway: 'residential', bicycle_road: 'yes' },
    { highway: 'residential', bicycle_road: 'yes', oneway: 'yes' },
    { highway: 'secondary', 'parking:right': 'lane' },
  ]
  const sides: OsmTags[] = [
    {},
    { 'cycleway:right': 'lane' },
    { 'cycleway:right': 'lane', 'cycleway:right:lane': 'exclusive' },
    { 'cycleway:right': 'track', 'cycleway:right:traffic_sign': 'DE:237' },
    { 'cycleway:right': 'lane', 'cycleway:right:separation:left': 'bollard' },
    { 'cycleway:right': 'lane', 'cycleway:right:traffic_mode:left': 'parking' },
    {
      'cycleway:right': 'lane',
      'cycleway:right:separation:left': 'bollard',
      'cycleway:right:traffic_mode:left': 'motor_vehicle',
      'cycleway:right:traffic_mode:right': 'parking',
      'cycleway:right:marking:left': 'solid_line',
    },
    { 'cycleway:both': 'no' },
    { surface: 'sett', width: '2', 'source:width': 'survey' },
  ]
  for (const base of bases) for (const side of sides) ways.push({ ...base, ...side })
  return ways
}

type Emitted = { attribute: RequiredAttribute }

function emitted(): Emitted[] {
  const out: Emitted[] = []
  const categories = listTargetCategories()
  for (const tags of corpus()) {
    let results: ReturnType<typeof processBikelanes> = []
    try {
      results = processBikelanes(tags)
    } catch {
      continue
    }
    for (const result of results) {
      for (const targetCategory of [undefined, ...categories]) {
        for (const attribute of requiredAttributes(result, tags, {
          profile: radnetzBerlin,
          targetCategory,
          edited: new Set(Object.keys(tags)),
        })) {
          out.push({ attribute })
        }
      }
    }
    for (const attribute of roadAttributes(tags, { profile: radnetzBerlin }))
      out.push({ attribute })
  }
  return out
}

describe('requirement texts', () => {
  const all = emitted()

  it('the corpus covers many attributes', () => {
    expect(all.length).toBeGreaterThan(500)
    expect(new Set(all.map((e) => e.attribute.id)).size).toBeGreaterThan(15)
  })

  it('every attribute id has a German and an English label', () => {
    expect(ATTRIBUTE_IDS.length).toBeGreaterThan(20)
    for (const language of LANGUAGES) {
      for (const id of ATTRIBUTE_IDS) {
        expect(ATTRIBUTE_LABELS[language][id], `${language} ${id}`).toBeTruthy()
        expect(attributeLabel(id, language)).not.toBe(id)
      }
    }
  })

  it('every attribute the engine returns is in ATTRIBUTE_IDS', () => {
    for (const { attribute } of all) expect(ATTRIBUTE_IDS).toContain(attribute.id)
  })

  it('there is no label for an id the engine never returns', () => {
    for (const id of Object.keys(ATTRIBUTE_LABELS.de)) expect(ATTRIBUTE_IDS).toContain(id)
  })

  it('every note and hint the engine returns has a text in both languages', () => {
    const notes = new Set<string>()
    const hints = new Set<string>()
    for (const { attribute } of all) {
      if (attribute.note) notes.add(attribute.note)
      if (attribute.hint) hints.add(attribute.hint)
    }
    expect([...notes].sort()).toEqual([
      'dual_carriageway',
      'oneway_bicycle',
      'oneway_road',
      'oneway_side',
      'surface_colour',
    ])
    expect([...hints]).toEqual(['traffic_mode_foot'])
    for (const language of LANGUAGES) {
      for (const note of notes) expect(ATTRIBUTE_NOTES[language][note], note).toBeTruthy()
      for (const hint of hints) expect(ATTRIBUTE_HINTS[language][hint], hint).toBeTruthy()
    }
  })

  it('every reminder of the radnetz profile has a title and a text in both languages', () => {
    const ids = radnetzBerlin.reminders.map((rule) => rule.id)
    expect(ids.length).toBeGreaterThan(0)
    for (const language of LANGUAGES) {
      for (const id of ids) {
        const text = reminderText(id, language)
        expect(text?.title, `${language} ${id}`).toBeTruthy()
        expect(text?.text, `${language} ${id}`).toBeTruthy()
      }
      expect(Object.keys(REMINDER_TEXTS[language]).sort()).toEqual([...ids].sort())
    }
    // and the reminders really come up in the corpus
    const seen = new Set<string>()
    for (const tags of corpus()) {
      for (const result of processBikelanes(tags)) {
        for (const category of [undefined, ...listTargetCategories()]) {
          for (const id of reminders(result, tags, radnetzBerlin, category)) seen.add(id)
        }
      }
    }
    expect([...seen].sort()).toEqual([...ids].sort())
  })

  it('QA states and attribute states have a label in both languages', () => {
    for (const language of LANGUAGES) {
      for (const state of ['complete', 'incomplete', 'unclear'] as const) {
        expect(QA_STATE_LABELS[language][state], state).toBeTruthy()
      }
      for (const state of ['ok', 'inherited', 'guess', 'assumed', 'ignored', 'missing'] as const) {
        expect(ATTRIBUTE_STATE_LABELS[language][state], state).toBeTruthy()
      }
    }
    expect(new Set(Object.values(ATTRIBUTE_STATE_LABELS.de)).size).toBe(6)
    expect(new Set(Object.values(ATTRIBUTE_STATE_LABELS.en)).size).toBe(6)
  })

  it('both languages have the same keys and placeholders in every table', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const table of [
      ATTRIBUTE_LABELS,
      ATTRIBUTE_NOTES,
      ATTRIBUTE_HINTS,
      ATTRIBUTE_STATE_TEXTS,
    ]) {
      expect(Object.keys(table.en).sort()).toEqual(Object.keys(table.de).sort())
      for (const key of Object.keys(table.de)) {
        expect(placeholders(table.en[key]!), key).toEqual(placeholders(table.de[key]!))
      }
    }
  })

  it('attributeNote renders every note without a loose placeholder', () => {
    let notes = 0
    for (const { attribute } of all) {
      for (const language of LANGUAGES) {
        const note = attributeNote(attribute, language)
        if (note === undefined) continue
        expect(note, JSON.stringify(attribute)).not.toMatch(/\{\w+\}/)
        notes += 1
      }
    }
    expect(notes).toBeGreaterThan(300)
    // the states that come up in the corpus; `ignored` and `ok` are in the examples below
    const statesWithNote = new Set<AttributeState>()
    for (const { attribute } of all) {
      if (attributeNote(attribute, 'de') !== undefined) statesWithNote.add(attribute.state)
    }
    for (const state of ['assumed', 'guess', 'inherited', 'missing'] as const) {
      expect(statesWithNote.has(state), state).toBe(true)
    }
  })

  it('attributeNote: the examples of the fork', () => {
    const base = { state: 'ok', value: 'yes', tilda: 'yes', source: undefined } as const
    expect(
      attributeNote({ ...base, state: 'inherited', value: undefined, tilda: 'asphalt' }, 'en'),
    ).toBe('TILDA takes asphalt from other tags (e.g. of the road)')
    expect(
      attributeNote(
        {
          ...base,
          state: 'inherited',
          value: undefined,
          tilda: 'parking',
          source: 'parking:right=lane',
        },
        'de',
      ),
    ).toBe('TILDA liest parking aus parking:right=lane')
    expect(
      attributeNote({ ...base, state: 'assumed', value: undefined, note: 'oneway_road' }, 'de'),
    ).toBe('Nicht getaggt = Straße mit Gegenverkehr.')
    expect(
      attributeNote(
        { ...base, state: 'assumed', value: undefined, default: 'surface:colour=no' },
        'en',
      ),
    ).toBe('Not tagged = surface:colour=no. Tag it only if it is different here.')
    expect(attributeNote({ ...base, state: 'ignored', value: 'foo' }, 'de')).toBe(
      'TILDA kann „foo“ nicht verwenden: Wähle einen anderen Wert',
    )
    expect(attributeNote({ ...base, state: 'ok' }, 'en')).toBeUndefined()
    expect(attributeNote({ ...base, state: 'ok', value: 'yes', tilda: 'no' }, 'en')).toBe(
      'TILDA reads it as no',
    )
    expect(
      attributeNote(
        { ...base, state: 'missing', value: undefined, hint: 'traffic_mode_foot' },
        'en',
      ),
    ).toContain('mapped as two lines')
  })

  it('attributeFeedsText', () => {
    expect(attributeFeedsText({ feeds: [] }, 'de')).toBeUndefined()
    expect(attributeFeedsText({ feeds: ['breite', 'ofm'] }, 'de')).toBe(
      'Genutzt für die infraVelo-Attribute: breite, ofm',
    )
  })
})
