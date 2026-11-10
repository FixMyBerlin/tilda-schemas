import { deriveTrafficSigns } from '../derive/derive-traffic-signs.ts'
import { extractValueFromLanes } from '../helpers/extract-value-from-lanes.ts'
/**
 * Declarative category specs — single source of truth for match rules and gap analysis.
 * OSMnexus-inspired: base `match` + nested `refining` for subcategories.
 */
import type { BicycleSurface, ImplicitOneWayConfidence, OsmTags } from '../types.ts'
import {
  bicycleRoadBase,
  bicycleRoadVehicleDestination,
  crossing,
  cyclewayOnHighwayAdvisoryOrExclusiveBase,
  cyclewayOnHighwayBetweenLanes,
  cyclewayOnHighwayProtected,
  footwayBicycleYes,
  implicitOneWay,
  isCrossingPattern,
  needsClarification,
  sharedBusLaneBikeWithBus,
  sharedBusLaneBusWithBike,
  unsignedCycleway,
} from './predicates.ts'
import { ADJOINING_OR_ISOLATED_REFINING, advisoryOrExclusiveRefining } from './refine-predicates.ts'
import type { TagPredicate } from './tag-predicate.ts'
import { pred } from './tag-predicate.ts'

export interface GapDiscriminator {
  key: string
  values: string[]
  unlocksCategory?: string
  reason: string
}

export interface RefiningChild {
  idSuffix: string
  match: TagPredicate
  implicitOneWayConfidence?: ImplicitOneWayConfidence
}

export interface CategorySpec {
  id: string
  infrastructureExists: boolean
  implicitOneWay: boolean
  implicitOneWayConfidence: ImplicitOneWayConfidence
  copySurfaceSmoothnessFromParent: boolean
  /** How `surface:bicycle` applies, see `deriveBikelaneSurfaceTags`; undefined ignores it. */
  bicycleSurface?: BicycleSurface
  match?: TagPredicate
  excludes?: TagPredicate[]
  refining?: RefiningChild[]
  gapDiscriminators?: GapDiscriminator[]
  process?: (tags: OsmTags) => void
}

function cyclewayOnHighwayBetweenLanesProcess(tags: OsmTags): void {
  const width = extractValueFromLanes('width:lanes', tags)
  if (width) tags.width = width
  const surface = extractValueFromLanes('surface:lanes', tags)
  if (surface) tags.surface = surface
  const surfaceColour = extractValueFromLanes('surface:colour:lanes', tags)
  if (surfaceColour) tags['surface:colour'] = surfaceColour
  const smoothness = extractValueFromLanes('smoothness:lanes', tags)
  if (smoothness) tags.smoothness = smoothness
  const sourceWidth = extractValueFromLanes('source:width:lanes', tags)
  if (sourceWidth) tags['source:width'] = sourceWidth
  const trafficSign = extractValueFromLanes('traffic_sign:lanes', tags)
  tags.traffic_sign = trafficSign ?? 'never'
}

function sharedBusLaneBusWithBikeProcess(tags: OsmTags): void {
  const r = deriveTrafficSigns(tags._parent)
  tags.traffic_sign = tags.traffic_sign ?? r.traffic_sign
  tags['traffic_sign:forward'] = tags['traffic_sign:forward'] ?? r['traffic_sign:forward']
  tags['traffic_sign:backward'] = tags['traffic_sign:backward'] ?? r['traffic_sign:backward']
}

function sharedBusLaneBikeWithBusProcess(tags: OsmTags): void {
  tags.traffic_sign = tags.traffic_sign ?? (tags._parent ? tags._parent.traffic_sign : undefined)
}

const SIDEpath_GAP: GapDiscriminator[] = [
  {
    key: 'is_sidepath',
    values: ['yes', 'no'],
    unlocksCategory: '_adjoining',
    reason: 'yes → adjoining (runs along a road); no → isolated (standalone path)',
  },
]

const LANE_GAP: GapDiscriminator[] = [
  {
    key: 'lane',
    values: ['advisory', 'exclusive'],
    unlocksCategory: '_advisory',
    reason:
      'advisory → Schutzstreifen; exclusive → Radfahrstreifen (transformed from cycleway:{side}:lane)',
  },
]

const NEEDS_CLARIFICATION_GAP_DISCRIMINATORS: GapDiscriminator[] = [
  {
    key: 'segregated',
    values: ['yes'],
    unlocksCategory: 'footAndCyclewaySegregated',
    reason: 'Segregated foot/cycle path',
  },
  {
    key: 'traffic_sign',
    values: ['DE:241'],
    unlocksCategory: 'footAndCyclewaySegregated',
    reason: 'German segregated foot/cycle sign',
  },
  {
    key: 'segregated',
    values: ['no'],
    unlocksCategory: 'footAndCyclewayShared',
    reason: 'Shared foot/cycle path',
  },
  {
    key: 'traffic_sign',
    values: ['DE:240'],
    unlocksCategory: 'footAndCyclewayShared',
    reason: 'German shared foot/cycle sign',
  },
  {
    key: 'traffic_sign',
    values: ['DE:237', 'none'],
    unlocksCategory: 'cycleway',
    reason:
      'German cycleway sign; on highway=cycleway also traffic_sign=none (unsigned cycleway, anderer Radweg)',
  },
  {
    key: 'cycleway',
    values: ['track', 'opposite_track'],
    unlocksCategory: 'cycleway',
    reason: 'Separated cycle track tagging',
  },
  {
    key: 'cycleway',
    values: ['lane', 'opposite_lane'],
    unlocksCategory: 'cyclewayOnHighway_advisoryOrExclusive',
    reason: 'On-highway cycle lane',
  },
  {
    key: 'bicycle',
    values: ['yes'],
    unlocksCategory: 'footwayBicycleYes',
    reason: 'Bicycle allowed on footway',
  },
]

const FOOT_AND_CYCLEWAY_HIGHWAYS = ['cycleway', 'path', 'footway', 'service', 'track'] as const

/** Shared foot/cycle path — tag membership with traffic_sign substring fallback. */
const FOOT_AND_CYCLEWAY_SHARED_MATCH: TagPredicate = pred.or(
  pred.and(
    pred.eq('highway', 'cycleway'),
    pred.eq('cycleway', 'track'),
    pred.or(pred.eq('segregated', 'no'), pred.includes('traffic_sign', '240')),
  ),
  pred.and(
    pred.in('highway', [...FOOT_AND_CYCLEWAY_HIGHWAYS]),
    pred.or(
      pred.and(
        pred.eq('segregated', 'no'),
        pred.eq('bicycle', 'designated'),
        pred.eq('foot', 'designated'),
      ),
      pred.and(pred.eq('segregated', 'no'), pred.eq('bicycle', 'yes'), pred.eq('foot', 'yes')),
      pred.includes('traffic_sign', '240'),
    ),
  ),
)

/** Segregated foot/cycle path — tag membership; separation_right macro kept for parity. */
const FOOT_AND_CYCLEWAY_SEGREGATED_MATCH: TagPredicate = pred.or(
  pred.and(
    pred.eq('highway', 'cycleway'),
    pred.eq('cycleway', 'track'),
    pred.or(pred.eq('segregated', 'yes'), pred.includes('traffic_sign', '241')),
  ),
  pred.and(
    pred.in('highway', ['cycleway', 'path', 'footway']),
    pred.or(
      pred.and(
        pred.eq('segregated', 'yes'),
        pred.eq('bicycle', 'designated'),
        pred.eq('foot', 'designated'),
      ),
      pred.and(pred.eq('segregated', 'yes'), pred.eq('bicycle', 'yes'), pred.eq('foot', 'yes')),
      pred.and(pred.includes('traffic_sign', '241'), pred.neq('highway', 'footway')),
    ),
  ),
  pred.macro('foot_and_cycleway_segregated_separation'),
)

/** Separated cycleway base — highway/cycleway tags plus sign 237 substring. */
const CYCLEWAY_SEPARATED_BASE_MATCH: TagPredicate = pred.or(
  pred.and(
    pred.eq('highway', 'cycleway'),
    pred.or(
      pred.eq('cycleway', 'track'),
      pred.eq('cycleway', 'opposite_track'),
      pred.exists('is_sidepath'),
    ),
  ),
  // Unsigned cycleway: `highway=cycleway` + `traffic_sign=none` (tilda-geo 98e649800).
  pred.macro('unsigned_cycleway'),
  pred.and(
    pred.in('highway', [
      'living_street',
      'pedestrian',
      'service',
      'track',
      'bridleway',
      'path',
      'footway',
      'cycleway',
    ]),
    pred.includes('traffic_sign', '237'),
  ),
)

export const CATEGORY_SPECS: CategorySpec[] = [
  {
    id: 'data_no',
    infrastructureExists: false,
    implicitOneWay: false,
    implicitOneWayConfidence: 'not_applicable',
    copySurfaceSmoothnessFromParent: false,
    match: pred.in('cycleway', ['no', 'none']),
  },
  {
    id: 'separate_geometry',
    infrastructureExists: false,
    implicitOneWay: false,
    implicitOneWayConfidence: 'not_applicable',
    copySurfaceSmoothnessFromParent: false,
    match: pred.eq('cycleway', 'separate'),
  },
  {
    id: 'not_expected',
    infrastructureExists: false,
    implicitOneWay: false,
    implicitOneWayConfidence: 'not_applicable',
    copySurfaceSmoothnessFromParent: false,
    // Uses transform-time _prefix/_parent fields not expressible as tag predicates.
    match: pred.macro('implicit_one_way'),
  },
  {
    id: 'cyclewayOnHighwayProtected',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'medium',
    copySurfaceSmoothnessFromParent: true,
    // Complex separation/traffic_mode matrix with allowedSeparation set.
    match: pred.macro('cycleway_on_highway_protected'),
  },
  {
    id: 'cyclewayLink',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'low',
    copySurfaceSmoothnessFromParent: false,
    match: pred.and(pred.eq('highway', 'cycleway'), pred.eq('cycleway', 'link')),
  },
  {
    id: 'crossing',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'low',
    copySurfaceSmoothnessFromParent: true,
    // Applies _length > 100 exclusion before crossing pattern check.
    match: pred.macro('crossing'),
  },
  {
    id: 'bicycleRoad_vehicleDestination',
    infrastructureExists: true,
    implicitOneWay: false,
    implicitOneWayConfidence: 'high',
    copySurfaceSmoothnessFromParent: true,
    bicycleSurface: 'strip',
    // Requires sanitizeTrafficSign for DE:244 prefix and German text variants.
    match: pred.macro('bicycle_road_vehicle_destination'),
  },
  {
    id: 'bicycleRoad',
    infrastructureExists: true,
    implicitOneWay: false,
    implicitOneWayConfidence: 'high',
    copySurfaceSmoothnessFromParent: true,
    bicycleSurface: 'strip',
    // Requires sanitizeTrafficSign for DE:244 prefix.
    match: pred.macro('bicycle_road_base'),
  },
  {
    id: 'sharedBusLaneBikeWithBus',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'high',
    copySurfaceSmoothnessFromParent: true,
    // Parent traffic_sign sanitization and DE:237/1024-14/1026-32 combos.
    match: pred.macro('shared_bus_lane_bike_with_bus'),
    process: sharedBusLaneBikeWithBusProcess,
  },
  {
    id: 'sharedBusLaneBusWithBike',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'high',
    copySurfaceSmoothnessFromParent: true,
    // Parent traffic_sign sanitization and DE:245/1022 combos.
    match: pred.macro('shared_bus_lane_bus_with_bike'),
    process: sharedBusLaneBusWithBikeProcess,
  },
  {
    id: 'pedestrianAreaBicycleYes',
    infrastructureExists: true,
    implicitOneWay: false,
    implicitOneWayConfidence: 'high',
    copySurfaceSmoothnessFromParent: false,
    bicycleSurface: 'strip',
    match: pred.and(pred.eq('highway', 'pedestrian'), pred.in('bicycle', ['yes', 'designated'])),
  },
  {
    id: 'sharedMotorVehicleLane',
    infrastructureExists: true,
    implicitOneWay: false,
    implicitOneWayConfidence: 'high',
    copySurfaceSmoothnessFromParent: true,
    bicycleSurface: 'strip',
    match: pred.and(pred.eq('highway', 'cycleway'), pred.eq('cycleway', 'shared_lane')),
  },
  {
    id: 'cyclewayOnHighwayBetweenLanes',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'high',
    copySurfaceSmoothnessFromParent: true,
    // Pipe-delimited lane substring checks on _side=self only.
    match: pred.macro('cycleway_on_highway_between_lanes'),
    process: cyclewayOnHighwayBetweenLanesProcess,
  },
  {
    id: 'footAndCyclewayShared',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'low',
    copySurfaceSmoothnessFromParent: false,
    bicycleSurface: 'whole_way',
    excludes: [pred.macro('is_crossing_pattern')],
    match: FOOT_AND_CYCLEWAY_SHARED_MATCH,
    refining: [...ADJOINING_OR_ISOLATED_REFINING],
    gapDiscriminators: SIDEpath_GAP,
  },
  {
    id: 'footAndCyclewaySegregated',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'low',
    copySurfaceSmoothnessFromParent: false,
    bicycleSurface: 'whole_way',
    excludes: [pred.macro('is_crossing_pattern')],
    match: FOOT_AND_CYCLEWAY_SEGREGATED_MATCH,
    refining: [...ADJOINING_OR_ISOLATED_REFINING],
    gapDiscriminators: SIDEpath_GAP,
  },
  {
    id: 'cycleway',
    infrastructureExists: true,
    implicitOneWay: false,
    implicitOneWayConfidence: 'low',
    copySurfaceSmoothnessFromParent: false,
    bicycleSurface: 'whole_way',
    excludes: [pred.macro('is_crossing_pattern'), pred.eq('cycleway', 'lane')],
    match: CYCLEWAY_SEPARATED_BASE_MATCH,
    refining: [...ADJOINING_OR_ISOLATED_REFINING],
    gapDiscriminators: SIDEpath_GAP,
  },
  {
    id: 'cyclewayOnHighway_advisoryOrExclusive',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'medium',
    copySurfaceSmoothnessFromParent: true,
    // Side-effect: may copy width from parent width:lanes when between-lanes.
    match: pred.macro('cycleway_on_highway_advisory_or_exclusive_base'),
    refining: advisoryOrExclusiveRefining(),
    gapDiscriminators: LANE_GAP,
  },
  {
    id: 'footwayBicycleYes',
    infrastructureExists: true,
    implicitOneWay: true,
    implicitOneWayConfidence: 'low',
    copySurfaceSmoothnessFromParent: false,
    bicycleSurface: 'whole_way',
    // mtb:scale numeric parsing and sanitizeTrafficSign for 1022-10.
    match: pred.macro('footway_bicycle_yes'),
    refining: [...ADJOINING_OR_ISOLATED_REFINING],
    gapDiscriminators: SIDEpath_GAP,
  },
  {
    id: 'needsClarification',
    infrastructureExists: true,
    implicitOneWay: false,
    implicitOneWayConfidence: 'low',
    copySurfaceSmoothnessFromParent: false,
    // Complex highway/path/footway fallback with mtb: surface exclusions.
    match: pred.macro('needs_clarification'),
    gapDiscriminators: NEEDS_CLARIFICATION_GAP_DISCRIMINATORS,
  },
]

export const CATEGORY_MACROS = {
  implicit_one_way: implicitOneWay,
  bicycle_road_base: bicycleRoadBase,
  bicycle_road_vehicle_destination: bicycleRoadVehicleDestination,
  is_crossing_pattern: (tags: OsmTags) => isCrossingPattern(tags) || undefined,
  foot_and_cycleway_segregated_separation: footAndCyclewaySegregatedSeparation,
  crossing,
  cycleway_on_highway_advisory_or_exclusive_base: cyclewayOnHighwayAdvisoryOrExclusiveBase,
  cycleway_on_highway_between_lanes: cyclewayOnHighwayBetweenLanes,
  cycleway_on_highway_protected: cyclewayOnHighwayProtected,
  shared_bus_lane_bus_with_bike: sharedBusLaneBusWithBike,
  shared_bus_lane_bike_with_bus: sharedBusLaneBikeWithBus,
  needs_clarification: needsClarification,
  footway_bicycle_yes: footwayBicycleYes,
  unsigned_cycleway: unsignedCycleway,
} as const

/** separation_right / traffic_mode_right branch not expressible as simple tag equality. */
function footAndCyclewaySegregatedSeparation(tags: OsmTags): boolean | undefined {
  const separationRight = tags.separation_right
  let separationCondition = true
  if (separationRight != null) separationCondition = separationRight === 'no'
  const trafficModeCondition = tags.traffic_mode_right === 'foot'
  if (tags.highway === 'cycleway' && trafficModeCondition && separationCondition) return true
  return undefined
}

export function specByCategoryId(id: string): CategorySpec | undefined {
  for (const spec of CATEGORY_SPECS) {
    if (spec.id === id) return spec
    if (spec.refining?.some((c) => resolveRefinedId(spec, c) === id)) {
      return { ...spec, id }
    }
  }
  return undefined
}

function resolveRefinedId(spec: CategorySpec, child: RefiningChild): string {
  if (child.idSuffix === '_advisoryOrExclusive' && spec.id.endsWith('_advisoryOrExclusive')) {
    return spec.id
  }
  const base = spec.id.replace(/_advisoryOrExclusive$/, '')
  return `${base}${child.idSuffix}`
}

export function isIncompleteCategoryId(categoryId: string): boolean {
  return (
    categoryId === 'needsClarification' ||
    categoryId.endsWith('_adjoiningOrIsolated') ||
    categoryId.endsWith('_advisoryOrExclusive')
  )
}

/** Specs with gap discriminators — for tests syncing analyzer output with declarative data. */
export function specsWithGapDiscriminators(): CategorySpec[] {
  return CATEGORY_SPECS.filter((s) => s.gapDiscriminators != null && s.gapDiscriminators.length > 0)
}
