import type { BikelaneResult, OsmTags } from '../types.ts'
import type { RequirementsProfile } from './types.ts'

/**
 * Reminders for things that have no tag to check: the mapper has to look for them. Which reminders
 * exist is part of the profile (`profile.reminders`); this returns the ids that apply to one
 * result. The app has the texts.
 */
export function reminders(
  result: BikelaneResult,
  tags: OsmTags,
  profile: RequirementsProfile,
  targetCategory?: string,
): string[] {
  const category = targetCategory ?? result.category
  if (!targetCategory && !result._infrastructureExists) return []
  return profile.reminders.filter((rule) => rule.applies(category, tags)).map((rule) => rule.id)
}
