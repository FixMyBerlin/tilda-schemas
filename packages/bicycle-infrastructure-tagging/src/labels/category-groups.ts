/**
 * Groups of TILDA categories for a "Change to" select, in the order mappers need them. Categories
 * the library offers that are in no group end up in `other` (see `groupCategories`).
 *
 * These are the groups of the iD Radnetz editor, kept for it. Mapping targets use the groups of
 * tilda-geo's map legend ("Führungsform einfach"): `MAPPING_TARGET_GROUPS`.
 */
export interface CategoryGroup {
  id: string
  categories: string[]
}

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    id: 'track',
    categories: ['cycleway_adjoining', 'cycleway_isolated', 'cycleway_adjoiningOrIsolated'],
  },
  {
    id: 'lane',
    categories: [
      'cyclewayOnHighway_advisory',
      'cyclewayOnHighway_exclusive',
      'cyclewayOnHighway_advisoryOrExclusive',
      'cyclewayOnHighwayProtected',
      'cyclewayOnHighwayBetweenLanes',
      'sharedMotorVehicleLane',
    ],
  },
  {
    id: 'foot',
    categories: [
      'footAndCyclewayShared_adjoining',
      'footAndCyclewayShared_isolated',
      'footAndCyclewayShared_adjoiningOrIsolated',
      'footAndCyclewaySegregated_adjoining',
      'footAndCyclewaySegregated_isolated',
      'footAndCyclewaySegregated_adjoiningOrIsolated',
      'footwayBicycleYes_adjoining',
      'footwayBicycleYes_isolated',
      'footwayBicycleYes_adjoiningOrIsolated',
      'pedestrianAreaBicycleYes',
    ],
  },
  { id: 'bus', categories: ['sharedBusLaneBikeWithBus', 'sharedBusLaneBusWithBike'] },
  { id: 'bicycle_road', categories: ['bicycleRoad', 'bicycleRoad_vehicleDestination'] },
  { id: 'special', categories: ['cyclewayLink', 'crossing'] },
]

/** `categories` sorted into `CATEGORY_GROUPS` (empty groups left out); the rest goes to `other` */
export function groupCategories(categories: string[]): CategoryGroup[] {
  const grouped = CATEGORY_GROUPS.map((group) => ({
    id: group.id,
    categories: group.categories.filter((category) => categories.includes(category)),
  }))
  const known = new Set(CATEGORY_GROUPS.flatMap((group) => group.categories))
  grouped.push({ id: 'other', categories: categories.filter((category) => !known.has(category)) })
  return grouped.filter((group) => group.categories.length)
}
