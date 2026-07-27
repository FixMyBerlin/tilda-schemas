/**
 * The highway values the Tilda LUA pipeline ingests for the roads_bikelanes topic.
 *
 * Single source of truth: the TS library (`@tilda-geo/bicycle-infrastructure`), which
 * ports `highway_classes.lua`. Re-exported here so the Overpass query (build-overpass-query.ts)
 * can never drift from the set the library actually processes.
 *
 * Note: `bridleway` is absent (the LUA pipeline always filters it). Further LUA filters
 * (service=driveway without bicycle access, area=yes, indoor, …) are intentionally NOT
 * applied here — the Overpass reference is a superset; the spec + library filter downstream.
 */
import {
  TRUNK_MOTORWAY_CLASSES,
  MAJOR_ROAD_CLASSES,
  MINOR_ROAD_CLASSES,
  PATH_CLASSES,
} from '@tilda-geo/bicycle-infrastructure'

export { TRUNK_MOTORWAY_CLASSES, MAJOR_ROAD_CLASSES, MINOR_ROAD_CLASSES, PATH_CLASSES }

export const RELEVANT_HIGHWAYS = [
  ...TRUNK_MOTORWAY_CLASSES,
  ...MAJOR_ROAD_CLASSES,
  ...MINOR_ROAD_CLASSES,
  ...PATH_CLASSES,
] as const
