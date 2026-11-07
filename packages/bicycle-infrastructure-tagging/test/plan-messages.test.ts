import { describe, expect, it } from 'bun:test'
import { TAG_REASON_CODES } from '@tilda-geo/bicycle-infrastructure'
import {
  PLAN_CONFLICT_CODES,
  PLAN_MESSAGES,
  PLAN_REASON_CODES,
  TILDA_LABELS,
  allMappingChoices,
  planCategoryChange,
  planForMappingChoice,
  renderPlanConflict,
  renderPlanReason,
} from '../src/index.ts'

const LANGUAGES = ['de', 'en'] as const

describe('plan messages', () => {
  it('every conflict code has a German and an English text', () => {
    for (const language of LANGUAGES) {
      for (const code of PLAN_CONFLICT_CODES) {
        expect(PLAN_MESSAGES[language][`conflict.${code}`], `${language} ${code}`).toBeTruthy()
      }
    }
  })

  it('every reason code, and every reason code of the core, has a German and an English text', () => {
    for (const language of LANGUAGES) {
      for (const code of PLAN_REASON_CODES) {
        expect(PLAN_MESSAGES[language][code], `${language} ${code}`).toBeTruthy()
      }
      for (const code of TAG_REASON_CODES) {
        expect(
          PLAN_MESSAGES[language][`category_requirement.${code}`],
          `${language} ${code}`,
        ).toBeTruthy()
      }
    }
  })

  it('both languages have the same keys and the same placeholders', () => {
    expect(Object.keys(PLAN_MESSAGES.en).sort()).toEqual(Object.keys(PLAN_MESSAGES.de).sort())
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const key of Object.keys(PLAN_MESSAGES.de)) {
      expect(placeholders(PLAN_MESSAGES.en[key]!), key).toEqual(
        placeholders(PLAN_MESSAGES.de[key]!),
      )
    }
  })

  it('every entry of every plan renders without a placeholder or a bare code', () => {
    const tagsList = [
      { highway: 'cycleway' },
      { highway: 'path', bicycle: 'designated', foot: 'designated', segregated: 'no' },
      { highway: 'residential', 'cycleway:both': 'no' },
      { highway: 'residential', 'cycleway:right': 'lane' },
      { highway: 'footway', footway: 'sidewalk' },
      { highway: 'pedestrian' },
    ]
    const categories = [
      'cycleway_adjoining',
      'footAndCyclewayShared_adjoining',
      'cyclewayOnHighway_exclusive',
      'cyclewayOnHighwayProtected',
      'cyclewayOnHighwayBetweenLanes',
      'bicycleRoad',
      'bicycleRoad_vehicleDestination',
      'sharedBusLaneBusWithBike',
      'footwayBicycleYes_isolated',
      'crossing',
      'pedestrianAreaBicycleYes',
    ]
    let entries = 0
    for (const tags of tagsList) {
      for (const side of ['self', 'left', 'right'] as const) {
        for (const category of categories) {
          const plans = [
            planCategoryChange(tags, category, side),
            ...allMappingChoices()
              .filter((choice) => choice.categoryId === category)
              .map((choice) => planForMappingChoice(tags, choice.choice, side)),
          ]
          for (const plan of plans) {
            for (const language of LANGUAGES) {
              for (const entry of [...plan.add, ...plan.change]) {
                const text = renderPlanReason(entry, language, {
                  categoryLabels: TILDA_LABELS.de,
                })
                expect(text, JSON.stringify(entry)).not.toMatch(/\{\w+\}/)
                expect(text).not.toBe(entry.code)
                entries += 1
              }
              for (const conflict of plan.conflicts) {
                const text = renderPlanConflict(conflict, language)
                expect(text, JSON.stringify(conflict)).not.toMatch(/\{\w+\}/)
                expect(text).not.toBe(conflict.code)
                entries += 1
              }
            }
          }
        }
      }
    }
    expect(entries).toBeGreaterThan(200)
  })

  it('names the category by its label when given labels', () => {
    const plan = planCategoryChange(
      { highway: 'cycleway' },
      'footAndCyclewaySegregated_adjoining',
      'self',
    )
    const entry = plan.add.find((e) => e.reasonCode === 'required_for_category')!
    expect(renderPlanReason(entry, 'en')).toBe(
      'Required for “footAndCyclewaySegregated_adjoining”.',
    )
    expect(renderPlanReason(entry, 'de', { categoryLabels: TILDA_LABELS.de })).toBe(
      'Nötig für „Getrennter Rad- und Gehweg, straßenbegleitend“.',
    )
  })

  it('a conflict of a plan names target and result', () => {
    const plan = planCategoryChange(
      { highway: 'residential' },
      'cyclewayOnHighwayBetweenLanes',
      'self',
    )
    expect(plan.conflicts[0]).toMatchObject({
      code: 'no_suggestion',
      params: { target: 'cyclewayOnHighwayBetweenLanes' },
    })
    expect(renderPlanConflict(plan.conflicts[0]!, 'de')).toContain('cyclewayOnHighwayBetweenLanes')
    const notEnough = planCategoryChange({ highway: 'cycleway' }, 'cycleway_adjoining', 'right')
    expect(notEnough.conflicts[0]).toMatchObject({ code: 'tags_not_enough' })
  })

  it('an unknown code returns the code', () => {
    expect(renderPlanConflict({ code: 'nope' as never }, 'de')).toBe('nope')
  })
})
