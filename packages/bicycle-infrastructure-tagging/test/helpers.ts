/**
 * The fork's tests call the functions without a profile. These wrappers bind the Radnetz Berlin
 * profile, so the carried-over tests keep their shape.
 */
import {
  planExtraction as planExtractionWith,
  reminders as remindersWith,
  requiredAttributes as requiredAttributesWith,
  roadAttributes as roadAttributesWith,
  tildaQaClasses as tildaQaClassesWith,
  tildaQaState as tildaQaStateWith,
  type BikelaneResult,
  type ExtractVariant,
  type JoinSigns,
  type OsmTags,
  type SignRecommend,
  type Side,
} from '../src/index.ts'
import { radnetzBerlin } from '../src/profiles/radnetz-berlin.ts'

export type Tags = OsmTags

export const requiredAttributes = (
  result: BikelaneResult,
  tags: OsmTags,
  targetCategory?: string,
  edited: ReadonlySet<string> = new Set(),
) => requiredAttributesWith(result, tags, { profile: radnetzBerlin, targetCategory, edited })

export const roadAttributes = (tags: OsmTags, edited: ReadonlySet<string> = new Set()) =>
  roadAttributesWith(tags, { profile: radnetzBerlin, edited })

export const tildaQaState = (tags: OsmTags) => tildaQaStateWith(tags, radnetzBerlin)
export const tildaQaClasses = (tags: OsmTags) => tildaQaClassesWith(tags, radnetzBerlin)

export const reminders = (result: BikelaneResult, tags: OsmTags, targetCategory?: string) =>
  remindersWith(result, tags, radnetzBerlin, targetCategory)

export const planExtraction = (
  road: OsmTags,
  variant: ExtractVariant,
  side: Side,
  recommend: SignRecommend | undefined,
  joinSigns?: JoinSigns,
) => planExtractionWith(road, variant, side, { recommend, joinSigns })
