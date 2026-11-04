import type { RequirementsProfile } from '../requirements/types.ts'
import type { OsmTags } from '../types.ts'

/**
 * The Radnetz Berlin dataset (infraVelo): which tags feed which dataset attribute, the traffic
 * signs offered per category, the damage signs and the sources of widths.
 *
 * Derived from `infravelo-radnetz/scripts/translate_attributes_tilda_to_rvn.py` and the TILDA
 * sanitizers.
 */

/** The infraVelo attributes a tag feeds */
export type InfraveloAttribute =
  | 'verkehrsri'
  | 'fuehr'
  | 'pflicht'
  | 'breite'
  | 'ofm'
  | 'farbe'
  | 'protek'
  | 'trennstreifen'
  | 'nutz_beschr'

/** Signs about damaged paths; mapped as `traffic_sign` too (Radinfra FAQ), wherever they are on the way */
export const DAMAGE_SIGNS = ['Radwegschäden', 'Gehwegschäden', 'Geh- und Radwegschäden'] as const

export const WIDTH_SOURCE_OPTIONS = [
  'Luftbild 2026',
  'Luftbild 2025',
  'Messung aus Punktwolke (Infra3DViewer)',
  'survey',
] as const

/** Traffic signs that set the infraVelo type (`fuehr`) or mandatory use (`pflicht`) */
export function radnetzTrafficSigns(category: string): string[] {
  if (category.startsWith('bicycleRoad')) return ['DE:244.1', 'DE:244.1,1020-30']
  if (category.startsWith('footAndCyclewayShared')) return ['DE:240', 'none']
  if (category.startsWith('footAndCyclewaySegregated')) return ['DE:241', 'none']
  if (category.startsWith('footwayBicycleYes')) return ['DE:239,1022-10', 'none']
  if (category === 'pedestrianAreaBicycleYes') return ['DE:242.1,1022-10']
  if (category === 'sharedBusLaneBusWithBike') return ['DE:245,1022-10']
  // "Linienverkehr frei" (Leistungsbeschreibung); TILDA also reads the older 1024-14
  if (category === 'sharedBusLaneBikeWithBus') return ['DE:237,1026-32']
  return ['DE:237', 'none']
}

const infraveloFeeds: Record<string, InfraveloAttribute[]> = {
  'common:traffic_sign': ['pflicht', 'fuehr', 'nutz_beschr'],
  'common:width': ['breite'],
  'common:source_width': ['breite'],
  'common:surface': ['ofm'],
  'common:sett_length': ['ofm'],
  'common:surface_colour': ['farbe'],
  'common:oneway': ['verkehrsri'],

  'separateWay:cycleway_width': ['breite'],
  'separateWay:source_cycleway_width': ['breite'],
  'separateWay:is_sidepath': ['fuehr'],
  'separateWay:segregated': ['fuehr'],
  'separateWay:traffic_mode_foot': ['fuehr'],

  'lane:lane': ['fuehr'],

  'nextToParking:traffic_mode_right': ['trennstreifen'],
  'nextToParking:buffer_right': ['trennstreifen'],

  'protection:traffic_mode_left': ['protek', 'trennstreifen'],
  'protection:traffic_mode_right': ['protek', 'trennstreifen'],
  'protection:separation_left': ['protek'],
  'protection:separation_right': ['protek'],
  'protection:marking_left': ['protek', 'trennstreifen'],
  'protection:marking_right': ['protek', 'trennstreifen'],
  'protection:buffer_left': ['protek', 'trennstreifen'],
  'protection:buffer_right': ['protek', 'trennstreifen'],

  'bicycleRoad:oneway_bicycle': ['verkehrsri'],
  'bicycleRoad:width_effective': ['breite'],
  'bicycleRoad:traffic_mode_left': ['trennstreifen'],
  'bicycleRoad:traffic_mode_right': ['trennstreifen'],
  'bicycleRoad:marking_left': ['trennstreifen'],
  'bicycleRoad:marking_right': ['trennstreifen'],
  'bicycleRoad:buffer_left': ['trennstreifen'],
  'bicycleRoad:buffer_right': ['trennstreifen'],

  'road:oneway': ['verkehrsri'],
  'road:oneway_bicycle': ['verkehrsri'],
  'road:dual_carriageway': ['verkehrsri'],
  'road:surface': ['ofm'],
  'road:sett_length': ['ofm'],
  'road:cycleway': ['fuehr'],
}

/** `traffic_sign` of the way or of any side holds a damage sign (it can be a `;` list) */
function hasDamageSign(tags: OsmTags) {
  return Object.keys(tags)
    .filter((key) => key === 'traffic_sign' || key.endsWith(':traffic_sign'))
    .some((key) =>
      tags[key]
        ?.split(';')
        .some((sign) => (DAMAGE_SIGNS as readonly string[]).includes(sign.trim())),
    )
}

const PATH_CATEGORY = /^(cycleway_|footAndCycleway|footwayBicycleYes_)/
/** cycle tracks along a road, raised kerb (Hochbord) */
const RAISED_TRACK_CATEGORY = /^cycleway_adjoining/

export const radnetzBerlin: RequirementsProfile = {
  id: 'radnetz-berlin',
  feeds: infraveloFeeds,
  trafficSignOptions: radnetzTrafficSigns,
  damageSigns: DAMAGE_SIGNS,
  widthSourceOptions: WIDTH_SOURCE_OPTIONS,
  // mosaic, small, large (Kopfsteinpflaster) as in the Radinfra FAQ
  settLengthOptions: ['0.05', '0.1', '0.15'],
  bufferOptions: ['no', '0.25', '0.5', '0.75', '1'],
  skipCategories: ['cyclewayLink'],
  reminders: [
    // a sign about damaged paths (`traffic_sign`), only until one is tagged
    {
      id: 'damage_signs',
      applies: (category, tags) => PATH_CATEGORY.test(category) && !hasDamageSign(tags),
    },
    // a barrier in front of the path (Absperrbake); no OSM tag, a TILDA note on the spot
    { id: 'barrier', applies: (category) => RAISED_TRACK_CATEGORY.test(category) },
  ],
}
