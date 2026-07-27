/** Port of topics/helper/highway_classes.lua */
export const TRUNK_MOTORWAY_CLASSES = ['motorway', 'motorway_link', 'trunk', 'trunk_link'] as const
export const MAJOR_ROAD_CLASSES = [
  'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
] as const
export const MINOR_ROAD_CLASSES = [
  'unclassified', 'residential', 'road', 'living_street', 'pedestrian', 'service',
] as const
// bridleway is intentionally omitted (always filtered by the LUA pipeline).
export const PATH_CLASSES = ['track', 'path', 'footway', 'cycleway', 'steps'] as const

/** Path-like for sidepath / transformation logic: PathClasses + pedestrian. */
export const SIDEPATH_HIGHWAY_CLASSES = new Set<string>([...PATH_CLASSES, 'pedestrian'])

export const ALLOWED_HIGHWAYS = new Set<string>([
  ...TRUNK_MOTORWAY_CLASSES,
  ...MAJOR_ROAD_CLASSES,
  ...MINOR_ROAD_CLASSES,
  ...PATH_CLASSES,
])
