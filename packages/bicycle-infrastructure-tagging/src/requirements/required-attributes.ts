import {
  CATEGORY_DEFINITIONS,
  DIRECTIONAL_PARKING_INFERENCE_CATEGORIES,
  MAJOR_ROAD_CLASSES,
  MARKING_ALLOWED,
  MINOR_ROAD_CLASSES,
  PARKING_ALLOWED,
  SEPARATION_ALLOWED,
  SURFACE_ALLOWED,
  SURFACE_COLOR_ALLOWED,
  TRAFFIC_MODE_ALLOWED,
  TRUNK_MOTORWAY_CLASSES,
  writeKeyForSide,
} from '@tilda-geo/bicycle-infrastructure'
import { sideOnewayDefault } from '../oneway.ts'
import { pathRole } from '../path-role.ts'
import type { BikelaneResult, OsmTags, ResultSide } from '../types.ts'
import type {
  AttributeState,
  RequiredAttribute,
  RequirementOptions,
  RequirementsProfile,
  RuleSet,
} from './types.ts'

/**
 * The attributes a way needs for a bicycle infrastructure dataset, per TILDA category. Keys are
 * written for the own way (`width`) and turned into side keys (`cycleway:right:width`) with
 * `writeKeyForSide`. What belongs to one dataset (which dataset attribute a tag feeds, signs,
 * sources) comes from the `RequirementsProfile`, see `profiles/radnetz-berlin`.
 */

type RuleContext = {
  tags: OsmTags
  result: BikelaneResult | undefined
  side: ResultSide
  prefix: string | null
  /** the target category, or the current one */
  category: string
  /** `category` is a target the mapper chose, not what TILDA reads now */
  isTarget: boolean
  /** keys changed in this editing session (tagged now, compared to the downloaded data) */
  edited: ReadonlySet<string>
  profile: RequirementsProfile
  /** tagged value for an own-way key on this side */
  value: (key: string) => string | undefined
}

type Rule = {
  id: string
  key: string
  /** set by `define` */
  ruleSet?: RuleSet
  options?: readonly string[] | ((ctx: RuleContext) => readonly string[])
  /** only values in `options` are valid (else any value, e.g. numbers); for rules without `tilda` */
  strict?: boolean
  /** other keys that also count as tagged; the value shows all of them (`left=no, right=lane`) */
  alsoKeys?: string[]
  /** other keys TILDA reads for the same value, after `key` (`surface:colour` for `cycleway:surface:colour`); not written */
  readKeys?: string[]
  /**
   * Directional keys `<key>:forward` / `<key>:backward` that replace the plain key together; with
   * only one of them the other direction is still missing
   */
  directions?: boolean
  /** what TILDA reads for this attribute */
  tilda?: (ctx: RuleContext) => string | number | null | undefined
  /** TILDA values that are only a guess, not tagged information */
  guesses?: readonly string[]
  /** the value assumed when the tag is missing, if that default is reliable (state `assumed`) */
  assumed?: (ctx: RuleContext) => string | undefined
  /** values offered for an `assumed` attribute (default: `options` without the default value) */
  assumedOptions?: readonly string[]
  /** id of the text for an `assumed` attribute (default: a generic text) */
  note?: string | ((ctx: RuleContext) => string | undefined)
  /** id of the text that frames when the attribute applies at all, in every state */
  hint?: string
  /**
   * The rule is the source of another key: `source:<key for this side>`, e.g. `source:cycleway:right:width`
   * (Radinfra FAQ decision: `source:` in front, not `cycleway:right:source:width`)
   */
  sourceFor?: string
  /** the tag TILDA derives the value from when the key is missing (state `inherited`, with that tag) */
  derivedFrom?: (ctx: RuleContext) => { tag: string; tilda: string } | undefined
  /** The tag TILDA reads instead of this key when both are there (`oneway:bicycle` wins over `oneway`) */
  overriddenBy?: (ctx: RuleContext) => string | undefined
  when?: (ctx: RuleContext) => boolean
  /** the rule does not apply here (another rule replaces it) */
  unless?: (ctx: RuleContext) => boolean
  optional?: boolean | ((ctx: RuleContext) => boolean)
}

/** Marks the rules of one set, so a profile can say which dataset attribute each one feeds. */
function define(ruleSet: RuleSet, rules: Rule[]): Rule[] {
  return rules.map((rule) => ({ ...rule, ruleSet }))
}

// Values TILDA accepts, from the sanitizers of @tilda-geo/bicycle-infrastructure. Values that are
// a list of two (`kerb;bollard`) or just `yes` are accepted by TILDA but not offered or valid here.
const plainValues = (values: readonly string[]) =>
  values.filter((value) => !value.includes(';') && value !== 'yes')
const SURFACE_OPTIONS = plainValues(SURFACE_ALLOWED)
const SURFACE_COLOUR_OPTIONS = [...SURFACE_COLOR_ALLOWED]
const SEPARATION_OPTIONS = plainValues(SEPARATION_ALLOWED)
/** TILDA has no `no` for marking: it drops the value, which means the same as untagged, so `no` is valid */
const MARKING_OPTIONS = ['no', ...MARKING_ALLOWED]
const TRAFFIC_MODE_OPTIONS = [...TRAFFIC_MODE_ALLOWED]

function trafficSignOptions(ctx: RuleContext): string[] {
  return [...ctx.profile.trafficSignOptions(ctx.category), ...ctx.profile.damageSigns]
}

function isSeparateWayCategory(category: string) {
  return (
    /^(cycleway_|footAndCycleway|footwayBicycleYes)/.test(category) ||
    category === 'needsClarification'
  )
}

function isOnRoadLaneCategory(category: string) {
  return (
    category.startsWith('cyclewayOnHighway_') ||
    category === 'cyclewayOnHighwayBetweenLanes' ||
    category.startsWith('sharedBusLane')
  )
}

function sidepathFromCategory(category: string) {
  if (category.endsWith('_adjoining')) return 'yes'
  if (category.endsWith('_isolated')) return 'no'
  return undefined
}

function field(name: keyof BikelaneResult) {
  return (ctx: RuleContext) => ctx.result?.[name] as string | number | null | undefined
}

/** TILDA has no `no` for marking: it drops the value, which means the same as untagged, so `no` is valid */
function markingField(side: 'left' | 'right') {
  return (ctx: RuleContext) =>
    ctx.result?.[`marking_${side}`] ?? (ctx.value(`marking:${side}`) === 'no' ? 'no' : undefined)
}

/**
 * `traffic_mode:*` from the road's `parking:<side>` (or `parking:both`), like TILDA infers it for
 * bicycle roads and lanes on the road: any parking means `parking`. `parking=no` gives no traffic
 * mode at all, like the LUA processing (the iD fork had `no`).
 */
function trafficModeFromParking(parkingSide: (ctx: RuleContext) => string) {
  return (ctx: RuleContext) => {
    if (
      !DIRECTIONAL_PARKING_INFERENCE_CATEGORIES.has(ctx.category) &&
      !ctx.category.startsWith('bicycleRoad')
    ) {
      return undefined
    }
    const key = [`parking:${parkingSide(ctx)}`, 'parking:both'].find(
      (k) => ctx.tags[k] !== undefined,
    )
    const value = key && ctx.tags[key]
    if (!key || !value || !(PARKING_ALLOWED as readonly string[]).includes(value)) return undefined
    if (value === 'no') return undefined
    return { tag: `${key}=${value}`, tilda: 'parking' }
  }
}

/** `traffic_mode` on this side is parking (tagged, or inferred from `parking:*` by TILDA) */
function parkingOn(side: 'left' | 'right') {
  return (ctx: RuleContext) =>
    (ctx.value(`traffic_mode:${side}`) ??
      (side === 'right' ? trafficModeFromParking((c) => c.side)(ctx)?.tilda : undefined) ??
      ctx.result?.[`traffic_mode_${side}`]) === 'parking'
}

/** `traffic_mode` is set on both sides (tagged, or taken from `parking:*`), so the delimitation can be asked */
function trafficModesSet(ctx: RuleContext) {
  const set = (side: 'left' | 'right') =>
    ctx.value(`traffic_mode:${side}`) !== undefined ||
    (side === 'right' && trafficModeFromParking((c) => c.side)(ctx) !== undefined)
  return set('left') && set('right')
}

/** Categories whose oneway default TILDA rates as reliable (lanes run with the traffic, bicycle roads are two-way) */
const RELIABLE_ONEWAY_DEFAULT = new Set(
  CATEGORY_DEFINITIONS.filter(
    (category) =>
      category.implicitOneWayConfidence === 'high' ||
      category.implicitOneWayConfidence === 'medium',
  ).map((category) => category.id),
)

/** TILDA takes the direction from `oneway:bicycle` when it is tagged (`derive_oneway.lua`) */
function onewayBicycleTag(ctx: RuleContext) {
  const value = ctx.side === 'self' ? ctx.tags['oneway:bicycle'] : undefined
  return value === undefined ? undefined : `oneway:bicycle=${value}`
}

/**
 * The oneway default, as a tag value, where it is reliable: on a road side always (never ask for
 * `cycleway:<side>:oneway`; see `sideOnewayDefault`), else TILDA's default for the category.
 */
function assumedOneway(ctx: RuleContext) {
  if (ctx.side !== 'self') return sideOnewayDefault(ctx.tags, ctx.side)
  if (!RELIABLE_ONEWAY_DEFAULT.has(ctx.category)) return undefined
  const category = CATEGORY_DEFINITIONS.find((c) => c.id === ctx.category)
  return category?.implicitOneWay ? 'yes' : 'no'
}

/** The width was tagged in this session: then say where the value comes from (not for existing widths) */
function widthEdited(key: string) {
  return (ctx: RuleContext) =>
    lookupKeys(key, ctx.side, ctx.prefix).some(
      (k) => ctx.tags[k] !== undefined && ctx.edited.has(k),
    )
}

const sourceWidthOptions = (ctx: RuleContext) => ctx.profile.widthSourceOptions

const SOURCE_WIDTH: Rule = {
  id: 'source_width',
  key: 'source:width',
  sourceFor: 'width',
  options: sourceWidthOptions,
  when: widthEdited('width'),
}

/** The way carries both modes on one line, and the parts are separate (`segregated=yes`). */
function isSegregatedWay(ctx: RuleContext) {
  if (ctx.side !== 'self') return false
  const role = pathRole(ctx.tags, { category: ctx.category })
  return role.style === 'oneLine' && role.segregated === true
}

/**
 * A cycleway line of two lines (the footway is a line of its own): `width` is its width. It has no
 * `segregated` and no part widths.
 */
function isCyclewayPartAlone(ctx: RuleContext) {
  if (ctx.side !== 'self') return false
  const role = pathRole(ctx.tags, { category: ctx.category })
  return role.style === 'twoLines' && role.part === 'bike'
}

/**
 * Footway and cycleway as separate parts of one way: we only measure the cycleway part. An
 * existing `width` is usually the whole way, so `cycleway:width` is asked for in any case, and
 * `width` is not.
 */
const SEGREGATED_WIDTH: Rule[] = [
  { id: 'cycleway_width', key: 'cycleway:width', options: [] },
  {
    id: 'source_cycleway_width',
    key: 'source:cycleway:width',
    sourceFor: 'cycleway:width',
    options: sourceWidthOptions,
    when: widthEdited('cycleway:width'),
  },
]

const COMMON = define('common', [
  {
    id: 'traffic_sign',
    key: 'traffic_sign',
    directions: true,
    options: trafficSignOptions,
    tilda: field('traffic_sign'),
  },
  {
    id: 'width',
    key: 'width',
    options: [],
    tilda: field('width'),
    // shared bus lanes: the lane width is only a side benefit (Radinfra FAQ)
    optional: (ctx) => ctx.category.startsWith('sharedBusLane'),
    unless: isSegregatedWay,
  },
  { ...SOURCE_WIDTH, unless: isSegregatedWay },
  { id: 'surface', key: 'surface', options: SURFACE_OPTIONS, tilda: field('surface') },
  {
    id: 'sett_length',
    key: 'sett:length',
    options: (ctx) => ctx.profile.settLengthOptions,
    when: (ctx) => ctx.value('surface') === 'sett',
  },
  {
    id: 'surface_colour',
    key: 'surface:colour',
    options: SURFACE_COLOUR_OPTIONS,
    strict: true,
    tilda: field('surface_color'),
    optional: true,
    assumed: () => 'no',
    note: 'surface_colour',
    unless: isSegregatedWay,
  },
  // footway and cycleway apart: TILDA reads the colour of the cycleway part (`cycleway:surface:colour`), else `surface:colour`
  {
    id: 'surface_colour',
    key: 'cycleway:surface:colour',
    readKeys: ['surface:colour'],
    options: SURFACE_COLOUR_OPTIONS,
    strict: true,
    tilda: field('surface_color'),
    optional: true,
    assumed: () => 'no',
    note: 'surface_colour',
    when: isSegregatedWay,
  },
  {
    id: 'oneway',
    key: 'oneway',
    options: ['yes', 'no', '-1'],
    tilda: field('oneway'),
    guesses: ['assumed_no', 'implicit_yes'],
    // lanes on the road run with the traffic, bicycle roads are two-way: TILDA's default is reliable there
    assumed: assumedOneway,
    overriddenBy: onewayBicycleTag,
    // a road side: only "both ways" is information, the direction follows from the side
    assumedOptions: ['no'],
    note: (ctx) => (ctx.side !== 'self' ? 'oneway_side' : undefined),
  },
])

const SEPARATE_WAY = define('separateWay', [
  ...SEGREGATED_WIDTH.map((rule) => ({
    ...rule,
    when: (ctx: RuleContext) => isSegregatedWay(ctx) && (rule.when?.(ctx) ?? true),
  })),
  {
    id: 'is_sidepath',
    key: 'is_sidepath',
    options: ['yes', 'no'],
    strict: true,
    // TILDA derives it from `footway=sidewalk` and similar; a chosen target category is no source
    tilda: (ctx) => (ctx.isTarget ? undefined : sidepathFromCategory(ctx.category)),
    when: (ctx) => ctx.side === 'self' && isSeparateWayCategory(ctx.category),
  },
  // a cycleway without foot access is the cycleway part alone: `segregated` is about one way for both modes
  {
    id: 'segregated',
    key: 'segregated',
    options: ['yes', 'no'],
    strict: true,
    when: (ctx) => ctx.category.startsWith('footAndCycleway') && !isCyclewayPartAlone(ctx),
  },
  // the cycleway part of a segregated foot and cycle path mapped as two lines: the footway is the
  // other line, right of it (TILDA reads `traffic_mode:right=foot` as "Getrennter Geh- und Radweg")
  {
    id: 'traffic_mode_foot',
    key: 'traffic_mode:right',
    options: ['foot'],
    strict: true,
    optional: true,
    hint: 'traffic_mode_foot',
    when: (ctx) => ctx.category.startsWith('footAndCyclewaySegregated') && isCyclewayPartAlone(ctx),
  },
])

const LANE = define('lane', [
  // TILDA has `_advisory` / `_exclusive` only from this tag, so the category is no source for it
  {
    id: 'lane',
    key: 'lane',
    options: ['advisory', 'exclusive'],
    strict: true,
    when: (ctx) => ctx.category.startsWith('cyclewayOnHighway_'),
  },
])

/**
 * Parking next to the lane: the buffer to it; TILDA infers parking from `parking:<side>`. The
 * lines are set by law, so no marking; no buffer is left untagged (Radinfra FAQ), so a missing
 * one is `no`.
 */
const NEXT_TO_PARKING = define('nextToParking', [
  // without parking TILDA has no traffic mode; so only needed where parking is not tagged on the road
  {
    id: 'traffic_mode_right',
    key: 'traffic_mode:right',
    options: TRAFFIC_MODE_OPTIONS,
    strict: true,
    tilda: field('traffic_mode_right'),
    optional: true,
    // TILDA reads the road's parking on the lane's side
    derivedFrom: trafficModeFromParking((ctx) => ctx.side),
    assumed: () => 'no',
  },
  {
    id: 'buffer_right',
    key: 'buffer:right',
    options: (ctx) => ctx.profile.bufferOptions,
    tilda: field('buffer_right'),
    when: parkingOn('right'),
    assumed: () => 'no',
  },
])

/**
 * Protected lane: `traffic_mode` on both sides first. The delimitation to the carriageway (left)
 * is always needed; with parking on the right, the one to the parking (right) as well, so both
 * sides together. The buffer is only recorded towards parking. All of it is asked only once
 * `traffic_mode` is set.
 */
function delimitation(): Rule[] {
  return [
    // only parking or foot next to it matter (Radinfra FAQ); TILDA reads parking on the outer side from `parking:*`
    // no default: the mapper decides first, the delimitation below is asked afterwards
    ...(['left', 'right'] as const).map(
      (side) =>
        ({
          id: `traffic_mode_${side}`,
          key: `traffic_mode:${side}`,
          options: TRAFFIC_MODE_OPTIONS,
          strict: true,
          tilda: field(`traffic_mode_${side}`),
          derivedFrom: side === 'right' ? trafficModeFromParking((ctx) => ctx.side) : undefined,
        }) as Rule,
    ),
    ...(['left', 'right'] as const).flatMap(
      (side) =>
        [
          {
            id: `separation_${side}`,
            key: `separation:${side}`,
            options: SEPARATION_OPTIONS,
            strict: true,
            tilda: field(`separation_${side}`),
            when:
              side === 'left'
                ? trafficModesSet
                : (ctx: RuleContext) => trafficModesSet(ctx) && parkingOn('right')(ctx),
          },
          {
            id: `marking_${side}`,
            key: `marking:${side}`,
            options: MARKING_OPTIONS,
            strict: true,
            tilda: markingField(side),
            when:
              side === 'left'
                ? trafficModesSet
                : (ctx: RuleContext) => trafficModesSet(ctx) && parkingOn('right')(ctx),
          },
          // the buffer exists only towards parking
          {
            id: `buffer_${side}`,
            key: `buffer:${side}`,
            options: (ctx: RuleContext) => ctx.profile.bufferOptions,
            tilda: field(`buffer_${side}`),
            when: (ctx: RuleContext) => trafficModesSet(ctx) && parkingOn(side)(ctx),
          },
        ] as Rule[],
    ),
  ]
}

const PROTECTION = define('protection', delimitation())

/** One-way roads: only `oneway:bicycle=no` says something; without the tag bicycles follow the one-way */
const ONEWAY_BICYCLE: Rule = {
  id: 'oneway_bicycle',
  key: 'oneway:bicycle',
  options: ['no', 'yes'],
  strict: true,
  assumed: () => 'yes',
  note: 'oneway_bicycle',
  when: (ctx) => ctx.value('oneway') === 'yes',
}

/** Bicycle roads: the white marking on both sides; with a line, the buffer to it (Radinfra FAQ) */
function lineMarking(side: 'left' | 'right') {
  return (ctx: RuleContext) =>
    ['solid_line', 'dashed_line', 'double_solid_line'].includes(ctx.value(`marking:${side}`) ?? '')
}

const BICYCLE_ROAD = define('bicycleRoad', [
  ONEWAY_BICYCLE,
  // the width inside the marking, without the buffer. Only where there is a marking, so optional.
  { id: 'width_effective', key: 'width:effective', options: [], optional: true },
  ...(['left', 'right'] as const).flatMap(
    (side) =>
      [
        {
          id: `traffic_mode_${side}`,
          key: `traffic_mode:${side}`,
          options: TRAFFIC_MODE_OPTIONS,
          strict: true,
          tilda: field(`traffic_mode_${side}`),
          optional: true,
          derivedFrom: trafficModeFromParking(() => side),
          assumed: () => 'no',
        },
        {
          id: `marking_${side}`,
          key: `marking:${side}`,
          options: MARKING_OPTIONS,
          strict: true,
          tilda: markingField(side),
        },
        {
          id: `buffer_${side}`,
          key: `buffer:${side}`,
          options: (ctx: RuleContext) => ctx.profile.bufferOptions,
          tilda: field(`buffer_${side}`),
          when: lineMarking(side),
        },
      ] as Rule[],
  ),
])

function rulesForCategory(category: string): Rule[] {
  if (category === 'cyclewayOnHighwayProtected') return [...COMMON, ...PROTECTION]
  if (isOnRoadLaneCategory(category)) return [...COMMON, ...LANE, ...NEXT_TO_PARKING]
  if (category.startsWith('bicycleRoad')) return [...COMMON, ...BICYCLE_ROAD]
  return [...COMMON, ...SEPARATE_WAY]
}

/**
 * Keys that TILDA reads for an own-way key on one side, most specific first:
 * `separation:left` → `separation:both` → `separation` (left only), and on a road side
 * `cycleway:right:<key>` → `cycleway:both:<key>` → `cycleway:<key>`.
 */
export function lookupKeys(key: string, side: ResultSide, prefix: string | null): string[] {
  const sided = key.match(/^(.*):(left|right)$/)
  const ownKeys = sided
    ? [key, `${sided[1]}:both`, ...(sided[2] === 'left' ? [sided[1]!] : [])]
    : [key]
  if (side === 'self' || !prefix) return ownKeys
  return ownKeys.flatMap((ownKey) => [
    `${prefix}:${side}:${ownKey}`,
    `${prefix}:both:${ownKey}`,
    `${prefix}:${ownKey}`,
  ])
}

function displayValue(value: unknown) {
  return value === null || value === undefined ? undefined : String(value)
}

/** `key=value` of all tagged keys, without their common prefix */
function summary(ctx: RuleContext, keys: string[]) {
  const tagged = keys.filter((key) => ctx.value(key) !== undefined)
  if (!tagged.length) return undefined
  if (tagged.length === 1) return ctx.value(tagged[0]!)
  return tagged.map((key) => `${key.split(':').pop()}=${ctx.value(key)}`).join(', ')
}

function evaluate(rules: Rule[], ctx: RuleContext): RequiredAttribute[] {
  return rules
    .filter((rule) => (!rule.when || rule.when(ctx)) && !rule.unless?.(ctx))
    .map((rule) => {
      const ownKeys = [rule.key, ...(rule.alsoKeys ?? [])]
      const keysFor = (key: string) =>
        rule.sourceFor
          ? lookupKeys(rule.sourceFor, ctx.side, ctx.prefix).map((k) => `source:${k}`)
          : [key, ...(key === rule.key ? (rule.readKeys ?? []) : [])].flatMap((k) =>
              lookupKeys(k, ctx.side, ctx.prefix),
            )
      const plain = rule.alsoKeys
        ? summary(ctx, [rule.key, ...rule.alsoKeys])
        : keysFor(rule.key)
            .map((k) => ctx.tags[k])
            .find((v) => v !== undefined)
      const directionKeys =
        rule.directions && plain === undefined
          ? ['forward', 'backward'].map((d) => `${rule.key}:${d}`)
          : []
      const directional = directionKeys.map((key) =>
        keysFor(key).find((k) => ctx.tags[k] !== undefined),
      )
      const oneDirection = directional.filter(Boolean).length === 1
      const value =
        plain ??
        (directional.every(Boolean) && directionKeys.length
          ? directional
              .map((k, i) => `${directionKeys[i]!.split(':').pop()}=${ctx.tags[k!]}`)
              .join(', ')
          : undefined)
      const lookup = [...new Set([...ownKeys, ...directionKeys].flatMap(keysFor))]
      const tagged = [...ownKeys, ...directionKeys]
        .map((key) => keysFor(key).find((k) => ctx.tags[k] !== undefined))
        .filter((key, i, keys): key is string => !!key && keys.indexOf(key) === i)
        .map((key) => ({ key, value: ctx.tags[key]! }))
      const derived = value === undefined ? rule.derivedFrom?.(ctx) : undefined
      const assumed = value === undefined && !derived ? rule.assumed?.(ctx) : undefined
      const tilda = oneDirection
        ? undefined
        : (derived?.tilda ?? assumed ?? displayValue(rule.tilda?.(ctx)))
      const allOptions = [
        ...(typeof rule.options === 'function' ? rule.options(ctx) : (rule.options ?? [])),
      ]
      // a default: offer only the values that say something else
      const options =
        assumed === undefined
          ? allOptions
          : [...(rule.assumedOptions ?? allOptions.filter((option) => option !== assumed))]
      const optional = typeof rule.optional === 'function' ? rule.optional(ctx) : !!rule.optional

      let state: AttributeState
      if (value !== undefined) {
        // TILDA does not read the directional keys, so a missing TILDA value says nothing about them
        const dropped = rule.tilda !== undefined && tilda === undefined && plain !== undefined
        const invalid = rule.tilda === undefined && rule.strict && !allOptions.includes(value)
        state = dropped || invalid ? 'ignored' : 'ok'
      } else if (derived) {
        state = 'inherited'
      } else if (assumed !== undefined) {
        state = 'assumed'
      } else if (tilda !== undefined) {
        state = rule.guesses?.includes(tilda) ? 'guess' : 'inherited'
      } else {
        state = 'missing'
      }

      const key = rule.sourceFor
        ? `source:${writeKeyForSide(rule.sourceFor, ctx.side, ctx.prefix)}`
        : writeKeyForSide(rule.key, ctx.side, ctx.prefix)
      const ruleSet = rule.ruleSet!

      return {
        id: rule.id,
        ruleSet,
        key,
        value,
        tagged,
        lookup,
        tilda,
        source:
          derived?.tag ??
          (value !== undefined && tilda !== undefined && tilda !== value
            ? rule.overriddenBy?.(ctx)
            : undefined),
        state,
        options,
        default: state === 'assumed' ? `${key}=${assumed}` : undefined,
        note:
          state === 'assumed'
            ? typeof rule.note === 'function'
              ? rule.note(ctx)
              : rule.note
            : undefined,
        optional,
        hint: rule.hint,
        feeds: [...(ctx.profile.feeds[`${ruleSet}:${rule.id}`] ?? [])],
      }
    })
}

function contextFor(
  tags: OsmTags,
  result: BikelaneResult | undefined,
  side: ResultSide,
  prefix: string | null,
  category: string,
  isTarget: boolean,
  options: RequirementOptions,
): RuleContext {
  return {
    tags,
    result,
    side,
    prefix,
    category,
    isTarget,
    edited: options.edited ?? new Set(),
    profile: options.profile,
    value: (key) =>
      lookupKeys(key, side, prefix)
        .map((k) => tags[k])
        .find((v) => v !== undefined),
  }
}

/** Categories that have no attributes: no infrastructure, and the ones the profile skips. */
function hasNoRequirements(category: string, profile: RequirementsProfile) {
  const definition = CATEGORY_DEFINITIONS.find((c) => c.id === category)
  return definition?.infrastructureExists === false || profile.skipCategories.includes(category)
}

/**
 * Required attributes for one TILDA result (one side of the way). With a `targetCategory`, the
 * list is for that category (the mapper is changing the way to it).
 */
export function requiredAttributes(
  result: BikelaneResult,
  tags: OsmTags,
  options: RequirementOptions,
): RequiredAttribute[] {
  const { targetCategory, profile } = options
  const category = targetCategory ?? result.category
  if (!targetCategory && !result._infrastructureExists) return []
  if (hasNoRequirements(category, profile)) return []

  const ctx = contextFor(
    tags,
    result,
    result._side,
    result._prefix,
    category,
    category !== result.category,
    options,
  )
  return evaluate(rulesForCategory(category), ctx)
}

const ROAD_CLASSES = new Set<string>([
  ...TRUNK_MOTORWAY_CLASSES,
  ...MAJOR_ROAD_CLASSES,
  ...MINOR_ROAD_CLASSES,
])
ROAD_CLASSES.delete('pedestrian')

export function isRoad(tags: OsmTags) {
  return !!tags.highway && ROAD_CLASSES.has(tags.highway)
}

const ROAD = define('road', [
  // a road without `oneway` is two-way (infraVelo drops `oneway=no` anyway)
  {
    id: 'oneway',
    key: 'oneway',
    options: ['yes', 'no', '-1'],
    assumed: () => 'no',
    note: 'oneway_road',
    overriddenBy: onewayBicycleTag,
  },
  ONEWAY_BICYCLE,
  {
    id: 'dual_carriageway',
    key: 'dual_carriageway',
    options: ['yes', 'no'],
    strict: true,
    optional: true,
    assumed: () => 'no',
    note: 'dual_carriageway',
    when: (ctx) => ctx.value('oneway') === 'yes',
  },
  // no width: a road in mixed traffic has no `breite` in the dataset
  { id: 'surface', key: 'surface', options: SURFACE_OPTIONS },
  {
    id: 'sett_length',
    key: 'sett:length',
    options: (ctx) => ctx.profile.settLengthOptions,
    when: (ctx) => ctx.value('surface') === 'sett',
  },
  {
    id: 'cycleway',
    key: 'cycleway:both',
    options: ['no', 'separate', 'lane', 'track'],
    // any of `cycleway`, `cycleway:both`, `cycleway:left`, `cycleway:right` says what is on the sides
    alsoKeys: ['cycleway', 'cycleway:left', 'cycleway:right'],
  },
])

/**
 * Attributes for the road itself (TILDA `roads` export, mixed traffic). Only for roads; bicycle
 * roads get their list from their bike infrastructure result.
 */
export function roadAttributes(
  tags: OsmTags,
  options: Omit<RequirementOptions, 'targetCategory'>,
): RequiredAttribute[] {
  if (!isRoad(tags)) return []
  return evaluate(ROAD, contextFor(tags, undefined, 'self', null, 'road', false, options))
}
