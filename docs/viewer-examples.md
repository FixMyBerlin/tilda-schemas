# Viewer examples: tag cases and expected TILDA categories

Input for the future viewer app (`apps/preview`) and for the example links on its start page. The viewer
shows what the package returns for a tag set (category, side, attributes, validation findings); it does
not compute anything itself. The cases below are the hard distinctions mappers get wrong.

The expected categories were checked against `processBikelanes` of `@tilda-geo/bicycle-infrastructure`
(0.1.2 plus the `main` state of this repo). Rows marked **target** describe the intended result that the
package does not reach yet (see "Open differences").

Tag notation as in the URL: `key=value` joined by `;`, e.g. `?tags=highway=cycleway;bicycle=designated`.
For a road with side tags the result has one entry per side (`_side` = `left` | `right`); for a separate
way it has one entry with `_side=self`.

## Separate way (`_side=self`)

| Case | Tags | Category |
| --- | --- | --- |
| Bare cycleway, the classic trap | `highway=cycleway` | `needsClarification` |
| Cycleway with both modes designated, nothing else | `highway=cycleway;bicycle=designated;foot=designated` | `needsClarification` |
| Cycleway, no sign (**target**) | `highway=cycleway;traffic_sign=none` | `cycleway_adjoiningOrIsolated` (tilda-geo `98e649800`); package still says `needsClarification` |
| Cycleway along a road | `highway=cycleway;is_sidepath=yes` | `cycleway_adjoining` |
| Cycleway, away from a road | `highway=cycleway;is_sidepath=no` | `cycleway_isolated` |
| Segregated foot and cycle path, one line | `highway=cycleway;bicycle=designated;foot=designated;segregated=yes` | `footAndCyclewaySegregated_adjoiningOrIsolated` |
| Same, with sign DE:241 | `highway=path;bicycle=designated;foot=designated;segregated=yes;traffic_sign=DE:241` | `footAndCyclewaySegregated_adjoiningOrIsolated` |
| Same along a road | `highway=path;bicycle=designated;foot=designated;segregated=yes;is_sidepath=yes` | `footAndCyclewaySegregated_adjoining` |
| Shared foot and cycle path, sign DE:240 | `highway=path;bicycle=designated;foot=designated;segregated=no;traffic_sign=DE:240` | `footAndCyclewayShared_adjoiningOrIsolated` |
| Shared foot and cycle path, no sign | `highway=path;bicycle=designated;foot=designated;segregated=no` | `footAndCyclewayShared_adjoiningOrIsolated` |
| Two lines: cycleway line carries the foot traffic of the adjacent footway | `highway=cycleway;is_sidepath=yes;bicycle=designated;traffic_mode:right=foot` | `footAndCyclewaySegregated_adjoining` |
| Footway with bicycles allowed | `highway=footway;footway=sidewalk;bicycle=yes` | `footwayBicycleYes_adjoining` |
| Footway with both designated, nothing else | `highway=footway;footway=sidewalk;bicycle=designated;foot=designated` | `needsClarification` |
| Protected bike lane as separate sidepath | `highway=cycleway;is_sidepath=yes;separation:left=bollard` | `cyclewayOnHighwayProtected` |
| Same, parking as protection | `highway=cycleway;is_sidepath=yes;traffic_mode:left=parking` | `cyclewayOnHighwayProtected` |
| Protection does not count with `segregated=yes` | `highway=cycleway;is_sidepath=yes;separation:left=bollard;segregated=yes` | `cycleway_adjoining` |

## Tags on the road (one result per side)

| Case | Tags | Result |
| --- | --- | --- |
| Advisory lane | `highway=residential;cycleway:right=lane;cycleway:right:lane=advisory` | right: `cyclewayOnHighway_advisory` |
| Exclusive lane | `highway=residential;cycleway:right=lane;cycleway:right:lane=exclusive` | right: `cyclewayOnHighway_exclusive` |
| Lane on both sides | `highway=residential;cycleway:both=lane;cycleway:both:lane=advisory` | left and right: `cyclewayOnHighway_advisory` |
| Protected lane (flex posts) | `highway=residential;cycleway:right=lane;cycleway:right:lane=exclusive;cycleway:right:separation:left=flex_post` | right: `cyclewayOnHighwayProtected` |
| Protected track (bollards) | `highway=residential;cycleway:right=track;cycleway:right:separation:left=bollard` | right: `cyclewayOnHighwayProtected` |
| Track with a kerb is not "protected" | `highway=residential;cycleway:right=track;cycleway:right:separation:left=kerb` | right: `cycleway_adjoining` |
| Track, no separation tag | `highway=residential;cycleway:right=track` | right: `cycleway_adjoining` |
| Track with `segregated=yes` (centerline style) | `highway=residential;cycleway:right=track;cycleway:right:segregated=yes` | right: `footAndCyclewaySegregated_adjoining` |
| Sidewalk with bicycles allowed | `highway=residential;sidewalk:right=yes;sidewalk:right:bicycle=yes` | right: `footwayBicycleYes_adjoining` |
| Shared bus lane | `highway=residential;cycleway:right=share_busway` | right: `sharedBusLaneBusWithBike` |
| No cycleway on either side | `highway=residential;cycleway:both=no` | left and right: `data_no` |
| Bicycle road | `highway=residential;bicycle_road=yes` | self: `bicycleRoad` |
| Bicycle road, motor vehicles to destination | `highway=residential;bicycle_road=yes;vehicle=destination` | self: `bicycleRoad_vehicleDestination` |

## What the viewer should do with them

- Start page: a few of these as links (shared path, segregated path, two lines with
  `traffic_mode:right=foot`, protected lane, bicycle road), grouped like the rows above.
- Result: category, `_side`, `_prefix`, German name. For `needsClarification`, the gaps from
  `analyzeCategoryGaps` ("which tag would decide this category") instead of generic help text; the
  plan for a chosen target comes from `planTagsForCategory` (both exist in the package already).
- The three mapping styles decide where a tag goes and must be visible in the UI (they are the usual
  source of errors):
  1. tags on the road centerline (`cycleway:right=track`, `cycleway:right:segregated=yes`),
  2. one separate line for foot and bike (`highway=path|cycleway|footway` with `segregated=yes|no`),
  3. two lines, a cycleway plus a footway; the cycleway line carries `traffic_mode:right=foot`.
- Do not offer `segregated=yes` on a pure cycleway line in the two-line style, and use `width` (not
  `cycleway:width`) there: the cycleway line is the cycleway part alone. This is how the iD fork
  handles it (commits `c199df552`, `97d682bed`, `3f3787700`).
- Mixed-up tags worth a hint in the UI: a separate way tagged only `highway=cycleway` that is physically a
  segregated foot and cycle path (the first two rows).

## Open differences (to settle before the viewer ships)

- `highway=cycleway` + `traffic_sign=none` is a plain cycleway in tilda-geo (`98e649800`); the package
  still returns `needsClarification`. Planned for the next sync with tilda-geo.
- The iD fork's category dropdown only lists TILDA categories; a signed (DE:240/241) and an unsigned
  variant of the same category are different mapping goals. The viewer needs the same list of
  mapping targets as the editors (see the overnight concept, part D4).

## Not carried over from the old helper plan

The July sketch (`osm-cycleway-tagging-helper`, Cursor plan, never implemented) is superseded by the
iD fork (`modules/ui/sections/tilda_bike_infra.ts`, `modules/tilda/*`) and the package:

- Its own question tree (`applyAnswers`, `listOpenQuestions`) duplicates `analyzeCategoryGaps` and
  `planTagsForCategory`; the viewer calls those.
- It planned a separate repo with a `file:` dependency and a "protected" example with
  `traffic_mode:right=motor_vehicle`. That tag set does not yield `cyclewayOnHighwayProtected` any more
  (it gives `cycleway_adjoining`); the protected examples above are the checked ones.
- English-only UI; the viewer and the editors show German category names.
