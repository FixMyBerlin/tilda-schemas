import { z } from 'zod'

/** In the order of the radio group: the minimal profile first */
export const PROFILES = ['tilda-geo', 'radnetz-berlin'] as const
export type Profile = (typeof PROFILES)[number]
export const DEFAULT_PROFILE: Profile = 'radnetz-berlin'

// `parseSearchWith(JSON.parse)` turns bare digits into numbers; tags and ids are strings.
const text = z.preprocess(
  (value) => (typeof value === 'number' ? String(value) : value),
  z.string().optional().catch(undefined),
)

/**
 * The whole state of the viewer. Keys at their default are left out of the URL.
 * - `tags`: `key=value;key=value` (see `tagsParam.ts`)
 * - `side`: the result to look at (`self`, `left`, `right`); default the first result
 * - `target`: id of a mapping target (`footAndCyclewayShared_isolated:unsigned`)
 * - `profile`: `radnetz-berlin` (default) or `tilda-geo`
 */
export const viewerSearchSchema = z.object({
  tags: text,
  side: z.enum(['self', 'left', 'right']).optional().catch(undefined),
  target: text,
  profile: z.enum(PROFILES).optional().catch(undefined),
})

export type ViewerSearch = z.infer<typeof viewerSearchSchema>
