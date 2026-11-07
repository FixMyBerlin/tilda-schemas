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
 * - `kind`: kind of infrastructure to change to (`footAndCyclewayShared`, `cycleway`, …), see `MAPPING_KINDS`
 * - `position`, `sign`, `lines`, `lifecycle`: options of the kind (`adjoining`/`isolated`,
 *   `signed`/`unsigned`, `two`, `construction`/`temporary`); left out when not set or at the default
 * - `profile`: `radnetz-berlin` (default) or `tilda-geo`
 */
export const viewerSearchSchema = z.object({
  tags: text,
  side: z.enum(['self', 'left', 'right']).optional().catch(undefined),
  kind: text,
  position: z.enum(['adjoining', 'isolated']).optional().catch(undefined),
  sign: z.enum(['signed', 'unsigned']).optional().catch(undefined),
  lines: z.enum(['one', 'two']).optional().catch(undefined),
  lifecycle: z.enum(['construction', 'temporary']).optional().catch(undefined),
  profile: z.enum(PROFILES).optional().catch(undefined),
})

export type ViewerSearch = z.infer<typeof viewerSearchSchema>
