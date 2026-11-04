import type { BikelaneResult, OsmTags } from '../types.ts'

/**
 * The attribute lists of a dataset. The engine knows which attributes a category needs; a profile
 * holds what is specific to one dataset: which dataset attribute a tag feeds, the traffic signs
 * and sources offered, the reminders.
 */
export interface RequirementsProfile {
  id: string
  /**
   * The dataset attributes a tag feeds, by `<ruleSet>:<attributeId>` (for example
   * `common:width`, `protection:separation_left`). Missing entries feed nothing.
   */
  feeds: Readonly<Record<string, readonly string[]>>
  /** Traffic signs offered for a category, without the damage signs */
  trafficSignOptions: (category: string) => readonly string[]
  /** Signs about damaged paths; they are mapped as `traffic_sign` too, wherever they are on the way */
  damageSigns: readonly string[]
  /** `source:width` values offered */
  widthSourceOptions: readonly string[]
  /** `sett:length` values offered */
  settLengthOptions: readonly string[]
  /** `buffer:*` values offered */
  bufferOptions: readonly string[]
  /** Categories with no requirements, besides the ones without infrastructure */
  skipCategories: readonly string[]
  /** Hints for things that have no tag to check: the mapper has to look for them */
  reminders: readonly ReminderRule[]
}

export interface ReminderRule {
  /** id of the reminder text */
  id: string
  /** `category` is the chosen target or the current category */
  applies: (category: string, tags: OsmTags) => boolean
}

export type RuleSet =
  | 'common'
  | 'separateWay'
  | 'lane'
  | 'nextToParking'
  | 'protection'
  | 'bicycleRoad'
  | 'road'

/**
 * - `ok`: tagged, TILDA reads it
 * - `inherited`: not tagged here, but TILDA gets a value elsewhere (road surface, `parking:*`, category)
 * - `guess`: not tagged, TILDA guesses (oneway)
 * - `assumed`: not tagged, and the default is reliable (a road is two-way); the mapper confirms it
 *   with a check that is stored outside of OSM, not with a tag
 * - `ignored`: tagged, but TILDA drops the value
 * - `missing`: not tagged
 */
export type AttributeState = 'ok' | 'inherited' | 'guess' | 'assumed' | 'ignored' | 'missing'

export type RequiredAttribute = {
  /** id of the attribute; the app has the label */
  id: string
  /** which rule set the attribute comes from */
  ruleSet: RuleSet
  /** the OSM key to write, for this side of the way (e.g. `cycleway:right:width`) */
  key: string
  /** the tagged value (also found via `:both` or the plain key, like TILDA reads it) */
  value: string | undefined
  /** the tags that were found, with the key they are tagged on (`cycleway:both:width=2`) */
  tagged: { key: string; value: string }[]
  /** all keys TILDA reads for this attribute, most specific first; to find the inspector field */
  lookup: string[]
  /** the value TILDA reads, after sanitizing (may come from the parent road) */
  tilda: string | undefined
  /** the tag TILDA derives an untagged value from (`parking:right=lane`) */
  source?: string
  state: AttributeState
  /** values TILDA accepts, offered as buttons; for `assumed` only the values that differ from the default */
  options: string[]
  /** `assumed`: the default as a tag (`surface:colour=no`); what the mapper confirms with a check */
  default?: string
  /** `assumed`: id of the text that says what the missing tag means */
  note?: string
  /** conditional attributes: a missing value is not an error */
  optional: boolean
  /** id of a text that says when the attribute applies at all */
  hint?: string
  /** the dataset attributes this tag feeds, from the profile */
  feeds: string[]
}

export interface RequirementOptions {
  profile: RequirementsProfile
  /** The mapper is changing the way to this category: list the attributes for it */
  targetCategory?: string
  /** keys changed in this editing session (tagged now, compared to the downloaded data) */
  edited?: ReadonlySet<string>
}

export type { BikelaneResult }
