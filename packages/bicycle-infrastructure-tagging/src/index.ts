/**
 * Tagging helpers for editors of bicycle infrastructure in OSM. Pure functions on plain OSM tags,
 * built on `@tilda-geo/bicycle-infrastructure` (the port of the TILDA processing). The data of one
 * dataset lives in a profile: `@tilda-geo/bicycle-infrastructure-tagging/profiles/radnetz-berlin`.
 */
export type { BikelaneResult, OsmTags, ResultSide, Side } from './types.ts'

// One definition of "path for foot and bicycle"
export { pathRole } from './path-role.ts'
export type { PathMappingStyle, PathRole, PathRoleOptions } from './path-role.ts'
export { sideOnewayDefault } from './oneway.ts'

// Planner: tags to reach a category
export {
  PLAN_CONFLICT_CODES,
  PLAN_REASON_CODES,
  applyCategoryPlan,
  categoryForSide,
  categoryGeometryMismatch,
  planCategoryChange,
  planCategoryVariants,
  planForMappingTarget,
  splitBothSides,
} from './planner/category-plan.ts'
export type {
  CategoryChangePlan,
  PlanConflict,
  PlanConflictCode,
  PlanReasonCode,
  PlannedAdd,
  PlannedChange,
} from './planner/category-plan.ts'
export { PLAN_MESSAGES, renderPlanConflict, renderPlanReason } from './planner/plan-messages.ts'
export type { PlanMessageOptions } from './planner/plan-messages.ts'
// The core planner and the list of targets stay in the core package; re-exported for convenience.
export { listTargetCategories } from '@tilda-geo/bicycle-infrastructure'

// Mapping targets: what a mapper picks (category + fixed tags), grouped like tilda-geo's legend
export {
  MAPPING_TARGETS,
  MAPPING_TARGET_GROUPS,
  MAPPING_TARGET_GROUP_LABELS,
  MAPPING_TARGET_LABELS,
  categoryMappingGroup,
  groupMappingTargets,
  mappingTargetById,
  mappingTargetLabel,
  mappingTargetsForCategory,
} from './mapping-targets/mapping-targets.ts'
export type {
  MappingTarget,
  MappingTargetGroup,
  MappingTargetGroupId,
  MappingTargetLanguage,
  MappingTargetVariant,
} from './mapping-targets/mapping-targets.ts'

// Labels and groups of categories (data, no localizer)
export {
  CATEGORY_GROUP_LABELS,
  TILDA_LABELS,
  categoryGroupLabel,
  categoryLabel,
  isLabelLanguage,
} from './labels/labels.ts'
export type { LabelLanguage, LabelMap } from './labels/labels.ts'
export { CATEGORY_GROUPS, groupCategories } from './labels/category-groups.ts'
export type { CategoryGroup } from './labels/category-groups.ts'

// Requirement engine
export {
  ATTRIBUTE_IDS,
  isRoad,
  lookupKeys,
  requiredAttributes,
  roadAttributes,
} from './requirements/required-attributes.ts'
export { tildaQaClasses, tildaQaState } from './requirements/qa-state.ts'
export type { QaResult, QaState } from './requirements/qa-state.ts'
export { reminders } from './requirements/reminders.ts'
export {
  ATTRIBUTE_HINTS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_NOTES,
  ATTRIBUTE_STATE_LABELS,
  ATTRIBUTE_STATE_TEXTS,
  QA_STATE_LABELS,
  REMINDER_TEXTS,
  attributeFeedsText,
  attributeHint,
  attributeLabel,
  attributeNote,
  attributeStateLabel,
  qaStateLabel,
  reminderText,
} from './requirements/texts.ts'
export type { ReminderText } from './requirements/texts.ts'
export type {
  AttributeState,
  ReminderRule,
  RequiredAttribute,
  RequirementOptions,
  RequirementsProfile,
  RuleSet,
} from './requirements/types.ts'

// Widths
export { roadWidthFromTags, widthTargetForKey } from './widths/width-tags.ts'
export type { WidthSide, WidthTarget } from './widths/width-tags.ts'
export {
  PART_WIDTH_KEYS,
  formatMeters,
  inheritedPartSource,
  partWidthMismatch,
  partWidthMode,
  partWidthWholeWay,
  redundantPartSourceUpdate,
  withoutRedundantPartSources,
} from './widths/part-widths.ts'
export type {
  PartWidthKey,
  PartWidthMismatch,
  PartWidthOptions,
  PartWidthWholeWay,
} from './widths/part-widths.ts'

// Extracting a road side into a way of its own, and merging cycleway and footway
export {
  DEFAULT_SIDEPATH_CONFIG,
  cyclewayKind,
  cyclewayOneway,
  extractOptions,
  planExtraction,
  setDirectionalValue,
  sidepathOffsetMeters,
  sideTags,
  sidewalkValue,
  splitSides,
} from './sidepath/extract-tags.ts'
export type {
  ExtractOption,
  ExtractVariant,
  ExtractionOptions,
  ExtractionPlan,
  SidepathConfig,
  SidepathPrefix,
} from './sidepath/extract-tags.ts'
export {
  DEFAULT_MERGE_CONFIG,
  combinedPathTags,
  commonTags,
  joinSignsPlain,
  mergeSelection,
  partKind,
  reverseTags,
} from './sidepath/merge-tags.ts'
export type {
  JoinSigns,
  MergeConfig,
  MergeSelection,
  MergeWay,
  PartKind,
  PathTagOptions,
  PathTags,
  SignRecommend,
} from './sidepath/merge-tags.ts'

// Validation rules (also the subpath `@tilda-geo/bicycle-infrastructure-tagging/validation`)
export {
  CYCLEWAY_ONEWAY_KEYS,
  MESSAGES,
  RADNETZ_RULES,
  RULES,
  TILDA_GEO_RULES,
  activeRules,
  applyTagFix,
  cyclewayOnewayFindings,
  isMessageLanguage,
  renderMessage,
  ruleById,
  validateTags,
} from './validations/index.ts'
export type {
  CyclewayOnewayFinding,
  CyclewayOnewayRuleId,
  Finding,
  MessageLanguage,
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
} from './validations/index.ts'
