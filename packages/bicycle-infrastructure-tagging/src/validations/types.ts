import type { BikelaneResult, OsmTags } from '../types.ts'

/**
 * How serious a finding is. `error`: the tags contradict each other or cannot be read. `warning`: the
 * tagging is unclear, wrong or not usable by data consumers. `info`: an attribute that is nice to have is
 * missing. An app maps these to its own scale (iD: `suggestion`, `warning`, `error`).
 */
export type RuleSeverity = 'error' | 'warning' | 'info'

/** Where a rule comes from: the TILDA processing (`todos_lines`) or a project of its own (iD Radnetz Berlin). */
export type RuleSource = 'tilda-geo' | 'radnetz'

/**
 * The part of a way a rule is about:
 * - `self`: a way of its own for walking or cycling (`highway=path|cycleway|footway`), its own tags
 * - `left` / `right`: a side of a road (`cycleway:left=*`, `sidewalk:right:bicycle=yes`)
 * - `road`: the tags of the road itself, or tags that cover both sides (`cycleway:both:oneway=yes`)
 */
export type RuleScope = 'self' | 'left' | 'right' | 'road'

export type MessageParams = Readonly<Record<string, string | number>>

/** A text of the app: a `code` into `MESSAGES` and the values for its `{placeholders}` */
export interface MessageRef {
  code: string
  params: MessageParams
}

/**
 * A change of tags that settles a finding. Applied in this order by `applyTagFix`: `remove`, `add`,
 * `change`. The tags are the tags of the way the finding is about (not of a side).
 */
export interface TagFix {
  /** The text of a button, e.g. "Remove cycleway:left:oneway" (code from `MESSAGES`) */
  message: MessageRef
  add?: Readonly<Record<string, string>>
  change?: Readonly<Record<string, { from: string; to: string }>>
  remove?: readonly string[]
}

/** One thing a rule found in the tags */
export interface Finding {
  ruleId: string
  severity: RuleSeverity
  source: RuleSource
  /** The part of the way it is about; a finding on both road sides with the same keys has the scope `road` */
  scope: RuleScope
  /** The keys of the tags it is about, as they are in the tags (for a side: `cycleway:left:traffic_sign`) */
  keys: readonly string[]
  /** What to tell the person; a code of `MESSAGES` and the values of its placeholders */
  message: MessageRef
  /** Ways out, best first. Empty when the tags need a look by a person. */
  fixes: readonly TagFix[]
}

export type ValidationProfile = 'tilda-geo' | 'radnetz-berlin'

export interface ValidationOptions {
  /**
   * Which rules run. `tilda-geo` (default): the rules of source `tilda-geo`. `radnetz-berlin`: those and the rules
   * of source `radnetz`.
   */
  profile?: ValidationProfile
  /** Length of the way in meters. Only `crossing_too_long` reads it; without it that rule cannot trigger. */
  length?: number
  /** Run only these rules (ids) */
  only?: readonly string[]
  /** Do not run these rules (ids), e.g. when the app has a rule of its own for it or a person turned it off */
  skip?: readonly string[]
}

/** What a rule found, before the rule adds its id, severity and source */
export interface RuleHit {
  scope: RuleScope
  keys: readonly string[]
  /** The values for the message of the rule; or a message of its own when the rule has several */
  message?: Partial<MessageRef>
  fixes?: readonly TagFix[]
}

/** What a rule may look at. Plain tags only: no geometry, no neighbours. */
export interface RuleContext {
  /** The tags of the way, including `_length` when `options.length` is set */
  readonly tags: OsmTags
  readonly options: ValidationOptions
  /** What `processBikelanes` of the core makes of the tags (computed once, on first use) */
  bikelanes(): BikelaneResult[]
}

export interface Rule {
  /** Stable, snake_case. For todos the id of the LUA todo (`unusual_width`). */
  id: string
  severity: RuleSeverity
  source: RuleSource
  appliesTo: readonly RuleScope[]
  /**
   * The keys the rule is about, for a list of rules. On a road side they are written for the way itself:
   * `traffic_sign` is `cycleway:left:traffic_sign` there, `{prefix}` is `cycleway:left`. A `*` stands for
   * `left`, `right` and `both`. The finding has the keys as they are in the tags.
   */
  keys: readonly string[]
  /**
   * The text of a finding: a code of `MESSAGES` (both languages). A rule with several reasons has further
   * codes `<code>.<reason>`.
   */
  message: { code: string }
  check(context: RuleContext): RuleHit[]
}
