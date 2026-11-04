/**
 * Validation rules for the tags of one way: the todos of tilda-geo and the rules of the iD Radnetz Berlin
 * editor, in one shape that an editor plugs into its own validator.
 *
 * - `validateTags(tags, options)` → `Finding[]`
 * - `RULES`: the catalogue, to list all rules and mark the ones that were found
 * - `MESSAGES` / `renderMessage`: the texts (de, en) by code
 * - `RULE_DESCRIPTIONS` / `ruleDescription`: a plain description per rule, for a catalogue
 * - `applyTagFix`: the tags after a fix
 *
 * Also exported from the root of the package.
 */
export { RULES, activeRules, ruleById, validateTags } from './validate.ts'
export { MESSAGES, isMessageLanguage, renderMessage } from './messages.ts'
export type { MessageLanguage } from './messages.ts'
export { RULE_DESCRIPTIONS, ruleDescription } from './descriptions.ts'
export { applyTagFix } from './fix.ts'
export { RADNETZ_RULES } from './radnetz-rules.ts'
export { TILDA_GEO_RULES } from './tilda-geo-rules.ts'
export type {
  Finding,
  MessageParams,
  MessageRef,
  Rule,
  RuleContext,
  RuleHit,
  RuleScope,
  RuleSeverity,
  RuleSource,
  TagFix,
  ValidationOptions,
  ValidationProfile,
} from './types.ts'
export { CYCLEWAY_ONEWAY_KEYS, cyclewayOnewayFindings } from './cycleway-oneway.ts'
export type { CyclewayOnewayFinding, CyclewayOnewayRuleId } from './cycleway-oneway.ts'
