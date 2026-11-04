import type { BikelaneResult, OsmTags } from '@tilda-geo/bicycle-infrastructure'

export type { BikelaneResult, OsmTags }

/** A side of a road, looking in the drawing direction of the way. */
export type Side = 'left' | 'right'

/** The part of a way a result is about: the way itself (`self`) or one of its road sides. */
export type ResultSide = BikelaneResult['_side']
