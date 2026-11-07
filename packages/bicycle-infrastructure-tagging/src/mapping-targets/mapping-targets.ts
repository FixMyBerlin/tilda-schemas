import {
  type PlanLifecycle,
  categorySignOptions,
  listTargetCategories,
  specsWithGapDiscriminators,
} from '@tilda-geo/bicycle-infrastructure'
import { TILDA_LABELS } from '../labels/labels.ts'

/**
 * Mapping targets: what a mapper picks in a "Change to" select. A TILDA category says what the
 * infrastructure is; whether it is signed is an attribute. For mapping, "shared foot and cycle path
 * with sign 240" and "without a sign" are two different goals. A mapping target is a category id
 * (1:1 the id of tilda-geo) plus the tags the plan must contain.
 *
 * The list is derived from the category specs of the core package: every category the planner can
 * target gets one target; a category that a traffic sign settles but that also works without one
 * gets a `signed` and an `unsigned` target. Hand-written additions are listed in
 * `EXTRA_MAPPING_TARGETS`.
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

/**
 * - `default`: the category, the planner picks the tags (fewest edits, no new traffic sign)
 * - `signed`: with the traffic sign that settles the category (`traffic_sign=DE:240`)
 * - `unsigned`: `traffic_sign=none` plus the tag that says the same (`segregated=no`)
 * - `twoLines`: cycleway whose footway is a line of its own (`traffic_mode:right=foot`)
 * - `construction`: the category under construction (`highway=construction` +
 *   `construction=cycleway`, on a road side `construction:cycleway:right=lane`); every category
 * - `temporary`: the category set up for a while (`temporary=yes`, on a road side
 *   `cycleway:right:temporary=yes`); only `TEMPORARY_CATEGORIES`
 */
export type MappingTargetVariant =
  | 'default'
  | 'signed'
  | 'unsigned'
  | 'twoLines'
  | 'construction'
  | 'temporary'

export type MappingTargetLanguage = 'de' | 'en'

export interface MappingTarget {
  /** `categoryId` for `default`, else `<categoryId>:<variant>` */
  id: string
  /** The TILDA category id, unchanged from tilda-geo */
  categoryId: string
  variant: MappingTargetVariant
  /**
   * Tags the plan must contain, as bare keys; the planner writes them for the side
   * (`cycleway:right:traffic_sign`). `traffic_sign=none` here is an explicit choice and may replace
   * a sign; without it the planner never overwrites `traffic_sign=none`.
   */
  fixed: Readonly<Record<string, string>>
  /** Key of `MAPPING_TARGET_LABELS` (the same as `id`) */
  labelCode: string
  group: MappingTargetGroupId
  /** Only for a way of its own, never for a road side */
  separateWayOnly: boolean
  /** The lifecycle the plan must give the side (`lifecycle` of tilda-geo) */
  lifecycle?: PlanLifecycle
}

/** A target without fixed tags or lifecycle: the plain category, the default plan */
export function isPlainMappingTarget(target: MappingTarget): boolean {
  return Object.keys(target.fixed).length === 0 && target.lifecycle === undefined
}

/**
 * Categories that are realistically set up for a while (a temporary lane at a construction site):
 * lanes on the road, protected lanes, foot and cycle paths and footways with bicycles allowed.
 */
const TEMPORARY_CATEGORIES = new Set([
  'cyclewayOnHighway_advisory',
  'cyclewayOnHighway_exclusive',
  'cyclewayOnHighwayProtected',
  'footAndCyclewayShared_adjoining',
  'footAndCyclewayShared_isolated',
  'footAndCyclewaySegregated_adjoining',
  'footAndCyclewaySegregated_isolated',
  'footwayBicycleYes_adjoining',
  'footwayBicycleYes_isolated',
])

/**
 * Categories a traffic sign settles in the specs, but where an unsigned variant is no legitimate
 * mapping: a Fahrradstraße exists only by its sign. They get one `default` target.
 */
const SIGN_REQUIRED_CATEGORIES = new Set(['bicycleRoad', 'bicycleRoad_vehicleDestination'])

/**
 * The tags besides `traffic_sign=none` that settle the category on their own, read from the gap
 * discriminators of `needsClarification` (e.g. `segregated=no` → `footAndCyclewayShared`). Keys the
 * mapper does not set on a way of their own (`cycleway=track`) are left out.
 */
function unsignedTags(categoryId: string): Record<string, string> {
  const baseId = categoryId.replace(/_(adjoining|isolated)$/, '')
  const needsClarification = specsWithGapDiscriminators().find(
    (spec) => spec.id === 'needsClarification',
  )
  const tags: Record<string, string> = {}
  for (const disc of needsClarification?.gapDiscriminators ?? []) {
    if (disc.unlocksCategory !== baseId) continue
    if (disc.key === 'traffic_sign' || disc.key === 'cycleway') continue
    tags[disc.key] = disc.values[0]!
  }
  return tags
}

/**
 * Mapping ways the specs cannot express as alternatives: the macro
 * `foot_and_cycleway_segregated_separation` makes `highway=cycleway` + `traffic_mode:right=foot`
 * a segregated foot and cycle path (in LUA too), so the two-line cycleway is a target of
 * `footAndCyclewaySegregated_*`, not of `cycleway_*`.
 */
const EXTRA_MAPPING_TARGETS: {
  categoryId: string
  variant: MappingTargetVariant
  fixed: Record<string, string>
  separateWayOnly: boolean
}[] = ['footAndCyclewaySegregated_adjoining', 'footAndCyclewaySegregated_isolated'].map(
  (categoryId) => ({
    categoryId,
    variant: 'twoLines',
    fixed: { highway: 'cycleway', 'traffic_mode:right': 'foot' },
    separateWayOnly: true,
  }),
)

function buildMappingTargets(): MappingTarget[] {
  const targets: MappingTarget[] = []
  const push = (
    categoryId: string,
    variant: MappingTargetVariant,
    fixed: Record<string, string>,
    separateWayOnly = false,
    lifecycle?: PlanLifecycle,
  ) => {
    const id = variant === 'default' ? categoryId : `${categoryId}:${variant}`
    targets.push({
      id,
      categoryId,
      variant,
      fixed,
      labelCode: id,
      group: categoryMappingGroup(categoryId) ?? 'needsClarification',
      separateWayOnly,
      ...(lifecycle ? { lifecycle } : {}),
    })
  }

  for (const categoryId of listTargetCategories()) {
    const { signs, unsignedPossible } = categorySignOptions(categoryId)
    if (signs.length && unsignedPossible && !SIGN_REQUIRED_CATEGORIES.has(categoryId)) {
      push(categoryId, 'signed', { traffic_sign: signs[0]! })
      push(categoryId, 'unsigned', { traffic_sign: 'none', ...unsignedTags(categoryId) })
    } else {
      push(categoryId, 'default', {})
    }
    for (const extra of EXTRA_MAPPING_TARGETS) {
      if (extra.categoryId === categoryId) {
        push(categoryId, extra.variant, extra.fixed, extra.separateWayOnly)
      }
    }
    push(categoryId, 'construction', {}, false, 'construction')
    if (TEMPORARY_CATEGORIES.has(categoryId)) push(categoryId, 'temporary', {}, false, 'temporary')
  }

  // in the order of the groups and of their categories, then signed / unsigned / two lines
  const rank = (target: MappingTarget) => {
    const groupIndex = MAPPING_TARGET_GROUPS.findIndex((group) => group.id === target.group)
    const categoryIndex = MAPPING_TARGET_GROUPS[groupIndex]?.categories.indexOf(target.categoryId)
    return groupIndex * 100 + (categoryIndex ?? 99)
  }
  return targets
    .map((target, index) => ({ target, index }))
    .sort((a, b) => rank(a.target) - rank(b.target) || a.index - b.index)
    .map(({ target }) => target)
}

/** All mapping targets, ordered by group (`MAPPING_TARGET_GROUPS`) */
export const MAPPING_TARGETS: readonly MappingTarget[] = buildMappingTargets()

export function mappingTargetById(id: string): MappingTarget | undefined {
  return MAPPING_TARGETS.find((target) => target.id === id)
}

/** The mapping targets of one TILDA category */
export function mappingTargetsForCategory(categoryId: string): MappingTarget[] {
  return MAPPING_TARGETS.filter((target) => target.categoryId === categoryId)
}

/** `MAPPING_TARGETS` sorted into their groups, empty groups left out */
export function groupMappingTargets(
  targets: readonly MappingTarget[] = MAPPING_TARGETS,
): { id: MappingTargetGroupId; targets: MappingTarget[] }[] {
  return MAPPING_TARGET_GROUPS.map((group) => ({
    id: group.id,
    targets: targets.filter((target) => target.group === group.id),
  })).filter((group) => group.targets.length)
}

/** English names of the target categories (tilda-geo has German labels only) */
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

function variantSuffix(target: MappingTarget, lang: MappingTargetLanguage): string | undefined {
  switch (target.variant) {
    case 'signed':
      return lang === 'de'
        ? `beschildert (${target.fixed.traffic_sign})`
        : `signed (${target.fixed.traffic_sign})`
    case 'unsigned':
      return lang === 'de' ? 'unbeschildert' : 'unsigned'
    case 'twoLines':
      return lang === 'de' ? 'Gehweg als eigene Linie' : 'footway as a line of its own'
    case 'construction':
      return lang === 'de' ? 'im Bau' : 'under construction'
    case 'temporary':
      return lang === 'de' ? 'temporär' : 'temporary'
    default:
      return undefined
  }
}

function buildLabels(lang: MappingTargetLanguage): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const target of MAPPING_TARGETS) {
    const category =
      lang === 'de'
        ? (TILDA_LABELS.de[`category=${target.categoryId}`] ?? target.categoryId)
        : (CATEGORY_LABELS_EN[target.categoryId] ?? target.categoryId)
    const suffix = variantSuffix(target, lang)
    labels[target.labelCode] = suffix ? `${category}, ${suffix}` : category
  }
  return labels
}

/** Labels of the mapping targets by `labelCode`; German category names come from tilda-geo */
export const MAPPING_TARGET_LABELS: Readonly<
  Record<MappingTargetLanguage, Readonly<Record<string, string>>>
> = {
  de: buildLabels('de'),
  en: buildLabels('en'),
}

export function mappingTargetLabel(id: string, lang: MappingTargetLanguage): string | undefined {
  return MAPPING_TARGET_LABELS[lang][id]
}
