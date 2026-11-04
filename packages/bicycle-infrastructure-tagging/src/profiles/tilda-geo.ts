import { categorySignOptions } from '@tilda-geo/bicycle-infrastructure'
import type { RequirementsProfile } from '../requirements/types.ts'

/**
 * The minimal profile: the attributes TILDA itself reads for a bike infrastructure feature, without
 * the extras of any dataset. For an editor or a tool that wants the "required attributes" without
 * the infraVelo Radnetz dataset (`profiles/radnetz-berlin`).
 *
 * What TILDA reads (`extract_bikelanes.lua` of tilda-geo, `BikelaneResult` of
 * `@tilda-geo/bicycle-infrastructure`): `width`, `source:width` (`width_source`), `width:effective`,
 * `surface` (with `sett:length` for sett stones), `surface:colour`, `oneway` (with `oneway:bicycle`),
 * `traffic_sign`, and `separation`, `traffic_mode`, `marking` and `buffer` per side, plus the tags
 * that decide the category (`is_sidepath`, `segregated`, `lane`, `cycleway`, `traffic_mode:right=foot`).
 * The engine asks for exactly these.
 *
 * Left out, compared to the Radnetz profile, because TILDA does not read them:
 * - the width and the width source of a part of a segregated path (`cycleway:width`,
 *   `source:cycleway:width`) and its colour (`cycleway:surface:colour`): TILDA reads `width`,
 *   `source:width` and `surface:colour` of the whole way (`partWidths: false`),
 * - `dual_carriageway` of the road (an infraVelo attribute),
 * - the reminders (damage signs and barriers are a Radnetz task),
 * - the damage signs as `traffic_sign` options,
 * - the infraVelo attributes a tag feeds (`feeds`), and the skipped category `cyclewayLink`.
 */
export const tildaGeo: RequirementsProfile = {
  id: 'tilda-geo',
  feeds: {},
  // The signs the category specs of TILDA settle a category with, and `none` where a category
  // works without a sign. Categories that no sign settles get only `none`; any sign can be typed.
  trafficSignOptions: (category) => {
    const { signs, unsignedPossible } = categorySignOptions(category)
    return [...signs, ...(unsignedPossible ? ['none'] : [])]
  },
  damageSigns: [],
  widthSourceOptions: [],
  // TILDA sorts sett stones by size: up to 8 cm mosaic, up to 13 cm small, above large
  settLengthOptions: ['0.05', '0.1', '0.15'],
  bufferOptions: ['no', '0.25', '0.5', '0.75', '1'],
  skipCategories: [],
  reminders: [],
  skipAttributes: ['dual_carriageway'],
  partWidths: false,
}
