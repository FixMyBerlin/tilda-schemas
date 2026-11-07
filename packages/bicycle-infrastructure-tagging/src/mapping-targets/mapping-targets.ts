import {
  type PlanLifecycle,
  categorySignOptions,
  listTargetCategories,
  specsWithGapDiscriminators,
} from '@tilda-geo/bicycle-infrastructure'
import { TILDA_LABELS } from '../labels/labels.ts'
import type { ResultSide } from '../types.ts'

/**
 * Mapping choices: what a mapper picks in a "Change to" form. A choice is a kind of
 * infrastructure (`cycleway`, `footAndCyclewaySegregated`, `cyclewayOnHighway_exclusive`) plus
 * options that do not exclude each other:
 *
 * - `position`: along a road or independent (`_adjoining` / `_isolated`); part of the TILDA
 *   category id, only for paths
 * - `sign`: as it is (no option), with the sign that settles the category, or `traffic_sign=none`
 * - `lines`: the footway as a line of its own (two lines); only a segregated path on its own way
 * - `lifecycle`: under construction or temporary; they exclude each other, and a way under
 *   construction gets no sign
 *
 * `mappingChoiceOptions` says which options a kind has on a side; `resolveMappingChoice` turns a
 * choice into the TILDA category and the tags the plan must contain. Everything is derived from the
 * category specs of the core package.
 */

/** Groups of tilda-geo's map legend "Führungsform einfach" (`subcat_bikelanes.const.ts`) */
export type MappingTargetGroupId =
  | 'separated'
  | 'lane'
  | 'foot'
  | 'sidewalk'
  | 'mixed'
  | 'needsClarification'

export interface MappingTargetGroup {
  id: MappingTargetGroupId
  /** All TILDA categories of the group, as in tilda-geo's legend layers (`bikelanes_default.ts`) */
  categories: readonly string[]
}

/** In the order of tilda-geo's legend. `needsClarification` has no mapping target. */
export const MAPPING_TARGET_GROUPS: readonly MappingTargetGroup[] = [
  {
    id: 'separated',
    categories: [
      'cycleway_adjoining',
      'cycleway_isolated',
      'cycleway_adjoiningOrIsolated',
      'footAndCyclewaySegregated_adjoining',
      'footAndCyclewaySegregated_isolated',
      'footAndCyclewaySegregated_adjoiningOrIsolated',
      'cyclewayOnHighwayProtected',
      'bicycleRoad',
    ],
  },
  {
    id: 'lane',
    categories: [
      'cyclewayOnHighway_advisory',
      'cyclewayOnHighway_exclusive',
      'cyclewayOnHighway_advisoryOrExclusive',
      'cyclewayOnHighwayBetweenLanes',
      'cyclewayLink',
      'crossing',
    ],
  },
  {
    id: 'foot',
    categories: [
      'footAndCyclewayShared_adjoining',
      'footAndCyclewayShared_isolated',
      'footAndCyclewayShared_adjoiningOrIsolated',
    ],
  },
  {
    id: 'sidewalk',
    categories: [
      'footwayBicycleYes_adjoining',
      'footwayBicycleYes_isolated',
      'footwayBicycleYes_adjoiningOrIsolated',
      'pedestrianAreaBicycleYes',
    ],
  },
  {
    id: 'mixed',
    categories: [
      'sharedMotorVehicleLane',
      'bicycleRoad_vehicleDestination',
      'sharedBusLaneBusWithBike',
      'sharedBusLaneBikeWithBus',
    ],
  },
  { id: 'needsClarification', categories: ['needsClarification'] },
]

/** The legend names of tilda-geo (German) and their English counterparts */
export const MAPPING_TARGET_GROUP_LABELS: Readonly<
  Record<MappingTargetLanguage, Readonly<Record<MappingTargetGroupId, string>>>
> = {
  de: {
    separated: 'Führung baul. abgesetzt von Kfz',
    lane: 'Führung eigenständig auf Fahrbahn',
    foot: 'Führung mit Fußverkehr',
    sidewalk: 'Fußverkehr mit Rad frei',
    mixed: 'Führung mit Kfz (explizit)',
    needsClarification: 'Führungsform unklar',
  },
  en: {
    separated: 'Physically separated from motor traffic',
    lane: 'Own lane on the carriageway',
    foot: 'Shared with pedestrians',
    sidewalk: 'Footway, bicycles allowed',
    mixed: 'Shared with motor traffic (explicit)',
    needsClarification: 'Unclear',
  },
}

/** The group of a TILDA category, or `undefined` for categories tilda-geo's legend does not show */
export function categoryMappingGroup(categoryId: string): MappingTargetGroupId | undefined {
  return MAPPING_TARGET_GROUPS.find((group) => group.categories.includes(categoryId))?.id
}

export type MappingTargetLanguage = 'de' | 'en'
export type MappingPosition = 'adjoining' | 'isolated'
export type MappingSign = 'signed' | 'unsigned'
export type MappingLines = 'one' | 'two'

/** What the mapper picks; options left out keep what the way has (or are not offered) */
export interface MappingChoice {
  /** A kind of `MAPPING_KINDS` */
  kind: string
  position?: MappingPosition
  sign?: MappingSign
  lines?: MappingLines
  lifecycle?: PlanLifecycle
}

/** One entry of the kind select */
export interface MappingKind {
  /** The TILDA category, or for paths the category without `_adjoining` / `_isolated` */
  id: string
  group: MappingTargetGroupId
  /** The TILDA categories of the kind (two for paths) */
  categories: string[]
}

/** The options a kind has on one side; an axis with fewer than two values is not offered */
export interface MappingChoiceOptions {
  position: MappingPosition[]
  /** `undefined` (as it is) is always possible besides these */
  sign: MappingSign[]
  /** The sign `signed` writes (`DE:241`) */
  signValue?: string
  lines: MappingLines[]
  /** `undefined` (built) is always possible besides these */
  lifecycle: PlanLifecycle[]
}

/** A choice resolved to what the planner needs */
export interface ResolvedMappingChoice {
  choice: MappingChoice
  /** `kind`, then the set options in a fixed order: `footAndCyclewayShared:adjoining:unsigned` */
  id: string
  /** The TILDA category id, unchanged from tilda-geo */
  categoryId: string
  /** Tags the plan must contain, as bare keys (written for the side by the planner) */
  fixed: Readonly<Record<string, string>>
  lifecycle?: PlanLifecycle
  /** Only for a way of its own, never for a road side (two lines) */
  separateWayOnly: boolean
}

const POSITIONED = /^(.+)_(adjoining|isolated)$/

/**
 * Categories that are realistically set up for a while (a temporary lane at a construction site):
 * lanes on the road, protected lanes, foot and cycle paths and footways with bicycles allowed.
 */
const TEMPORARY_KINDS = new Set([
  'cyclewayOnHighway_advisory',
  'cyclewayOnHighway_exclusive',
  'cyclewayOnHighwayProtected',
  'footAndCyclewayShared',
  'footAndCyclewaySegregated',
  'footwayBicycleYes',
])

/** A Fahrradstraße exists only by its sign: no sign option */
const SIGN_REQUIRED_CATEGORIES = new Set(['bicycleRoad', 'bicycleRoad_vehicleDestination'])

/** The footway as a line of its own: LUA reads `highway=cycleway` + `traffic_mode:right=foot` as segregated */
const TWO_LINES_KINDS = new Set(['footAndCyclewaySegregated'])
const TWO_LINES_TAGS = { highway: 'cycleway', 'traffic_mode:right': 'foot' }

/**
 * The tags besides `traffic_sign=none` that settle the category on their own, read from the gap
 * discriminators of `needsClarification` (e.g. `segregated=no` → `footAndCyclewayShared`). Keys the
 * mapper does not set on a way of their own (`cycleway=track`) are left out.
 */
function unsignedTags(kind: string): Record<string, string> {
  const needsClarification = specsWithGapDiscriminators().find(
    (spec) => spec.id === 'needsClarification',
  )
  const tags: Record<string, string> = {}
  for (const disc of needsClarification?.gapDiscriminators ?? []) {
    if (disc.unlocksCategory !== kind) continue
    if (disc.key === 'traffic_sign' || disc.key === 'cycleway') continue
    tags[disc.key] = disc.values[0]!
  }
  return tags
}

function buildKinds(): MappingKind[] {
  const kinds: MappingKind[] = []
  for (const categoryId of listTargetCategories()) {
    const id = POSITIONED.exec(categoryId)?.[1] ?? categoryId
    const kind = kinds.find((k) => k.id === id)
    if (kind) kind.categories.push(categoryId)
    else {
      kinds.push({
        id,
        group: categoryMappingGroup(categoryId) ?? 'needsClarification',
        categories: [categoryId],
      })
    }
  }
  const rank = (kind: MappingKind) => {
    const groupIndex = MAPPING_TARGET_GROUPS.findIndex((group) => group.id === kind.group)
    const categoryIndex = MAPPING_TARGET_GROUPS[groupIndex]?.categories.indexOf(kind.categories[0]!)
    return groupIndex * 100 + (categoryIndex ?? 99)
  }
  return kinds.sort((a, b) => rank(a) - rank(b))
}

/** The entries of the kind select, ordered by group (`MAPPING_TARGET_GROUPS`) */
export const MAPPING_KINDS: readonly MappingKind[] = buildKinds()

export function mappingKindById(id: string): MappingKind | undefined {
  return MAPPING_KINDS.find((kind) => kind.id === id)
}

/** The kind and position of a TILDA category (`footAndCyclewayShared_isolated`) */
export function mappingChoiceForCategory(categoryId: string): MappingChoice | undefined {
  const positioned = POSITIONED.exec(categoryId)
  const kind = mappingKindById(positioned?.[1] ?? categoryId)
  if (!kind || !kind.categories.includes(categoryId)) return undefined
  return positioned
    ? { kind: kind.id, position: positioned[2] as MappingPosition }
    : { kind: kind.id }
}

/** `MAPPING_KINDS` sorted into their groups, empty groups left out */
export function groupMappingKinds(): { id: MappingTargetGroupId; kinds: MappingKind[] }[] {
  return MAPPING_TARGET_GROUPS.map((group) => ({
    id: group.id,
    kinds: MAPPING_KINDS.filter((kind) => kind.group === group.id),
  })).filter((group) => group.kinds.length)
}

function categoryOf(kind: MappingKind, position: MappingPosition | undefined): string {
  if (kind.categories.length === 1) return kind.categories[0]!
  return `${kind.id}_${position ?? 'adjoining'}`
}

/**
 * The options of a kind on `side`. They depend on the choice: under construction there is no sign
 * option, with two lines there is no road side.
 */
export function mappingChoiceOptions(
  choice: MappingChoice,
  side: ResultSide = 'self',
): MappingChoiceOptions {
  const kind = mappingKindById(choice.kind)
  const none: MappingChoiceOptions = { position: [], sign: [], lines: [], lifecycle: [] }
  if (!kind) return none
  const position: MappingPosition[] =
    kind.categories.length < 2 ? [] : side === 'self' ? ['adjoining', 'isolated'] : ['adjoining']
  const categoryId = categoryOf(kind, choice.position)
  const { signs, unsignedPossible } = categorySignOptions(categoryId)
  const signOffered =
    signs.length > 0 &&
    unsignedPossible &&
    !SIGN_REQUIRED_CATEGORIES.has(categoryId) &&
    choice.lifecycle !== 'construction'
  const lines: MappingLines[] =
    TWO_LINES_KINDS.has(kind.id) && side === 'self' ? ['one', 'two'] : []
  const lifecycle: PlanLifecycle[] = TEMPORARY_KINDS.has(kind.id)
    ? ['construction', 'temporary']
    : ['construction']
  return {
    position,
    sign: signOffered ? ['signed', 'unsigned'] : [],
    ...(signOffered ? { signValue: signs[0]! } : {}),
    lines,
    lifecycle,
  }
}

/** The choice with the options the kind does not offer on `side` left out */
export function normalizeMappingChoice(
  choice: MappingChoice,
  side: ResultSide = 'self',
): MappingChoice {
  const options = mappingChoiceOptions(choice, side)
  const position =
    choice.position && options.position.includes(choice.position)
      ? choice.position
      : options.position[0]
  // the sign options depend on the lifecycle, the lifecycle not on the sign
  const lifecycle =
    choice.lifecycle && options.lifecycle.includes(choice.lifecycle) ? choice.lifecycle : undefined
  const settled = mappingChoiceOptions({ ...choice, position, lifecycle }, side)
  const sign = choice.sign && settled.sign.includes(choice.sign) ? choice.sign : undefined
  const lines = choice.lines === 'two' && settled.lines.includes('two') ? 'two' : undefined
  return {
    kind: choice.kind,
    ...(position ? { position } : {}),
    ...(sign ? { sign } : {}),
    ...(lines ? { lines } : {}),
    ...(lifecycle ? { lifecycle } : {}),
  }
}

/** `kind`, then the set options: `footAndCyclewaySegregated:isolated:unsigned:two:construction` */
export function mappingChoiceId(choice: MappingChoice): string {
  return [
    choice.kind,
    choice.position,
    choice.sign,
    choice.lines === 'two' ? 'two' : undefined,
    choice.lifecycle,
  ]
    .filter(Boolean)
    .join(':')
}

/**
 * The TILDA category and the tags of a choice (normalized for `side` first), or `undefined` for an
 * unknown kind.
 */
export function resolveMappingChoice(
  choice: MappingChoice,
  side: ResultSide = 'self',
): ResolvedMappingChoice | undefined {
  const kind = mappingKindById(choice.kind)
  if (!kind) return undefined
  const normalized = normalizeMappingChoice(choice, side)
  const categoryId = categoryOf(kind, normalized.position)
  const options = mappingChoiceOptions(normalized, side)
  const fixed: Record<string, string> = {}
  if (normalized.lines === 'two') Object.assign(fixed, TWO_LINES_TAGS)
  if (normalized.sign === 'signed') fixed.traffic_sign = options.signValue!
  if (normalized.sign === 'unsigned')
    Object.assign(fixed, { traffic_sign: 'none' }, unsignedTags(kind.id))
  return {
    choice: normalized,
    id: mappingChoiceId(normalized),
    categoryId,
    fixed,
    ...(normalized.lifecycle ? { lifecycle: normalized.lifecycle } : {}),
    separateWayOnly: normalized.lines === 'two',
  }
}

/** Every choice a way of its own can have; for docs and tests */
export function allMappingChoices(): ResolvedMappingChoice[] {
  const all: ResolvedMappingChoice[] = []
  const seen = new Set<string>()
  for (const kind of MAPPING_KINDS) {
    const positions = mappingChoiceOptions({ kind: kind.id }).position
    for (const position of positions.length ? positions : [undefined]) {
      const base = { kind: kind.id, ...(position ? { position } : {}) }
      const { lifecycle } = mappingChoiceOptions(base)
      for (const life of [undefined, ...lifecycle]) {
        const withLife = { ...base, ...(life ? { lifecycle: life } : {}) }
        const options = mappingChoiceOptions(withLife)
        for (const sign of [undefined, ...options.sign]) {
          for (const lines of options.lines.length ? options.lines : [undefined]) {
            const resolved = resolveMappingChoice({
              ...withLife,
              ...(sign ? { sign } : {}),
              ...(lines ? { lines } : {}),
            })!
            if (seen.has(resolved.id)) continue
            seen.add(resolved.id)
            all.push(resolved)
          }
        }
      }
    }
  }
  return all
}

const CATEGORY_LABELS_EN: Readonly<Record<string, string>> = {
  bicycleRoad: 'Bicycle road',
  bicycleRoad_vehicleDestination: 'Bicycle road, motor vehicles allowed',
  crossing: 'Crossing',
  cyclewayLink: 'Cycleway link',
  cycleway_adjoining: 'Cycleway along a road',
  cycleway_isolated: 'Cycleway, independent',
  cyclewayOnHighway_advisory: 'Advisory cycle lane',
  cyclewayOnHighway_exclusive: 'Cycle lane',
  cyclewayOnHighwayBetweenLanes: 'Cycle lane between lanes',
  cyclewayOnHighwayProtected: 'Protected cycle lane',
  footAndCyclewaySegregated_adjoining: 'Segregated foot and cycle path along a road',
  footAndCyclewaySegregated_isolated: 'Segregated foot and cycle path, independent',
  footAndCyclewayShared_adjoining: 'Shared foot and cycle path along a road',
  footAndCyclewayShared_isolated: 'Shared foot and cycle path, independent',
  footwayBicycleYes_adjoining: 'Footway, bicycles allowed, along a road',
  footwayBicycleYes_isolated: 'Footway, bicycles allowed, independent',
  pedestrianAreaBicycleYes: 'Pedestrian zone, bicycles allowed',
  sharedBusLaneBikeWithBus: 'Cycle lane, buses allowed',
  sharedBusLaneBusWithBike: 'Bus lane, bicycles allowed',
  sharedMotorVehicleLane: 'Shared lane (sharrows)',
}

/** Names of the kinds; the German ones come from tilda-geo's category labels */
function kindLabelOf(kind: MappingKind, lang: MappingTargetLanguage): string {
  if (lang === 'en') {
    if (kind.categories.length === 1) return CATEGORY_LABELS_EN[kind.id] ?? kind.id
    return KIND_LABELS_EN[kind.id] ?? kind.id
  }
  const label =
    TILDA_LABELS.de[`category=${kind.id}_adjoiningOrIsolated`] ??
    TILDA_LABELS.de[`category=${kind.categories[0]}`] ??
    kind.id
  // "Radweg (Straßenbegleitend oder selbstständig geführt; …)" → "Radweg"
  return kind.categories.length > 1 ? label.replace(/\s*\(.*$/, '') : label
}

const KIND_LABELS_EN: Readonly<Record<string, string>> = {
  cycleway: 'Cycleway',
  footAndCyclewayShared: 'Shared foot and cycle path',
  footAndCyclewaySegregated: 'Segregated foot and cycle path',
  footwayBicycleYes: 'Footway, bicycles allowed',
}

export function mappingKindLabel(kindId: string, lang: MappingTargetLanguage): string {
  const kind = mappingKindById(kindId)
  return kind ? kindLabelOf(kind, lang) : kindId
}

/** Labels of the option axes and their values */
export const MAPPING_OPTION_LABELS = {
  de: {
    position: 'Lage',
    adjoining: 'straßenbegleitend',
    isolated: 'selbstständig geführt',
    sign: 'Beschilderung',
    asIs: 'wie vorhanden',
    signed: 'beschildert',
    unsigned: 'unbeschildert',
    lines: 'Linien',
    one: 'eine Linie',
    two: 'zwei Linien (Gehweg als eigene Linie)',
    lifecycle: 'Zustand',
    built: 'fertig',
    construction: 'im Bau',
    temporary: 'temporär',
  },
  en: {
    position: 'Position',
    adjoining: 'along a road',
    isolated: 'independent',
    sign: 'Signs',
    asIs: 'as it is',
    signed: 'signed',
    unsigned: 'unsigned',
    lines: 'Lines',
    one: 'one line',
    two: 'two lines (footway as a line of its own)',
    lifecycle: 'State',
    built: 'built',
    construction: 'under construction',
    temporary: 'temporary',
  },
} as const

/** The label of a whole choice: `Getrennter Rad- und Gehweg, straßenbegleitend, unbeschildert` */
export function mappingChoiceLabel(choice: MappingChoice, lang: MappingTargetLanguage): string {
  const words = MAPPING_OPTION_LABELS[lang]
  const options = mappingChoiceOptions(choice)
  const parts = [mappingKindLabel(choice.kind, lang)]
  if (choice.position) parts.push(words[choice.position])
  if (choice.sign === 'signed') parts.push(`${words.signed} (${options.signValue})`)
  if (choice.sign === 'unsigned') parts.push(words.unsigned)
  if (choice.lines === 'two') parts.push(words.two)
  if (choice.lifecycle) parts.push(words[choice.lifecycle])
  return parts.join(', ')
}
