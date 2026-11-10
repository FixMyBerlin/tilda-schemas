# @tilda-geo/bicycle-infrastructure

## 0.2.0

### Minor Changes

- 163ed67: Bikelanes read `surface:bicycle`, `smoothness:bicycle` and the directional and side values `surface:forward|backward` and `surface:left|right`, as tilda-geo does since `7acec52af`. Fahrradstraßen, pedestrian areas and shared lanes take the bicycle surface and smoothness; cycleways and shared foot/cycle paths use `surface:bicycle` as their surface; without `surface` the worst directional or side value wins. Lanes and bus lanes without `cycleway:<side>:surface` fall back to the road's bicycle, side or direction value for their half. `surface_source` can now be `tag_directional` and `parent_highway_tag_directional`. The German `description` texts the port wrote into the tags (access road, agricultural traffic, construction, blocked) are no longer written; the package never output `description`.
- be35255: - New result field `todos` (ids of the tagging problems of a feature, like `_todo_list` in tilda-geo) and `todoTagFixes`, plus the exports `BIKELANE_TODOS`, `deriveBikelaneTodos` and `isUnusualWidth`. Ported from `bikelane_todo_categories.lua`, without the todos that need Mapillary, the object age or the sidepath CSV.
  - `needs_clarification_track` is checked per road side: a sign (DE:237, DE:240, DE:241) or `segregated` on one side closes only that side (tilda-geo `48b04faf5`).
  - New todo `unusual_width` (width we cannot read, `0`, negative or above 50 m, closed by a check date) and `unexpected_oneway_direction` (`cycleway:left:oneway=yes`, `cycleway:right:oneway=-1` on a road that is not oneway; follows tilda-geo-private#34, not merged yet). `missing_oneway` is no longer set for lanes and tracks on the road.
- 0815bef: - Export the value lists of the sanitizers (`SEPARATION_ALLOWED`, `PROTECTIVE_SEPARATION`, `MARKING_ALLOWED`, `TRAFFIC_MODE_ALLOWED`, `SURFACE_COLOR_ALLOWED`, `SURFACE_ALLOWED`, `PARKING_ALLOWED`, `DIRECTIONAL_PARKING_INFERENCE_CATEGORIES`) so editors offer the values the processing accepts.
  - Export `defaultSideRunsAgainstWay(road, side)`: the riding direction of a lane without `cycleway:<side>:oneway`, as the processing derives it (follows tilda-geo-private#34, not merged yet).
- 3cfdb4d: The packages are now licensed under ISC (before AGPL-3.0-or-later), and the tarballs contain the license text and a notice: the logic is ported from the LUA processing of tilda-geo (AGPL-3.0), whose rights holder FixMyCity GmbH publishes it here under ISC. Text and schemas of the repository are CC BY 4.0.
- da0b384: The results of `processBikelanes` have `lifecycle` (`construction`, `construction_no_access`, `blocked`, `temporary`): the side's own, else the one of its road, as in tilda-geo. `temporary=yes` and `cycleway|sidewalk[:<side>]:temporary=yes` are read as `lifecycle=temporary` (tilda-geo `08b1428b5`), and `construction:cycleway=*` without a side counts for the cycleway, not the road (`4138bc51f`).

  `planTagsForCategory` takes the option `lifecycle` (`construction` or `temporary`). The tagging package has mapping targets `<category>:construction` for every category and `<category>:temporary` for lanes, the protected lane, foot and cycle paths and footways with bicycles allowed, the helpers `lifecycleForSide` and `isPlainMappingTarget`, and the conflict `lifecycle_not_reached`.

- f45a2fa: Follows four fixes of the tilda-geo processing:

  - `missing_segregated` only fires when `segregated` is neither `yes` nor `no`.
  - `missing_access_tag_240` fires when `bicycle=designated` or `foot=designated` is missing, not only when both are.
  - A lane between the car lanes (`cycleway:lanes=no|no|lane|no`) that is also tagged on the road side with `traffic_sign=none` is no unsigned cycleway on that side.
  - The text of `unexpected_highway_path` says `highway=cycleway`.

- 7d1aad9: Every entry of a tag plan (`add`, `change`, `conflicts` of `planTagsForCategory`) has a stable `reasonCode` (for example `required_for_category`, `bicycle_road_sign`, `plan_not_enough`) and, where the reason names something, `reasonParams` (`{ category }`, `{ target, result }`). The English `reason` stays for compatibility. `TAG_REASON_CODES`, `TagReason` and `TagReasonCode` are exported, so an app can write its own texts for the reasons.
- 7ec6d4c: `planTagsForCategory` plans a road side completely, also when the side has no tags yet. Before, it wrote bare keys on the road (`cycleway=lane`, `lane=exclusive`) and even suggested `highway=cycleway`; only the tagging package's wrapper hid this.

  - The plan has a new field `remove`: `cycleway:both` (or `cycleway`) when it is split into `cycleway:left` and `cycleway:right`.
  - `cycleway:<side>` gets the value the category needs, a footway category sets `sidewalk:<side>`. New reason codes `split_both_sides` and `side_presence`.
  - On a road side the planner never changes `highway`. Of the two objects of a side (`cycleway:right`, `sidewalk:right`) it works on the one the category lives on.
  - `writeKeyForSide` without a prefix writes under `cycleway:<side>`.

  Tagging package: the wrapper uses this and drops its own side handling. `splitBothSides` is removed. `categoryForSide` takes the target category as an optional third argument to read the right object of a side.

- ad544b0: When the planner splits `cycleway:both` (or `cycleway`) into the two sides, it moves the sub-keys too (`cycleway:both:lane=advisory` → `cycleway:left:lane=advisory` and `cycleway:right:lane=advisory`), so the way keeps one scheme. A footway with bicycles allowed on a road side no longer splits the cycleway of the road. New export `categorySidePrefix(categoryId)`: the prefix of the road side object a category lives on (`sidewalk` or `cycleway`); the tagging package uses it.
- ca9be72: The planner (`planTagsForCategory`) reads the alternatives of a category from the category specs:

  - Tags that settle a category are alternatives, not a conjunction: `segregated=yes` (with `bicycle` and `foot`) or `traffic_sign=DE:241` is enough, the plan never asks for both. Plans without a new traffic sign come first; a bare `highway=cycleway` → `cycleway_isolated` needs only `is_sidepath=no`.
  - `traffic_sign=none` (or `no`) is never overwritten. When one alternative already holds, no sign is added.
  - Fixed: target `*_adjoining` changes `is_sidepath=no` to `yes`.
  - New option `fixed` (tags the plan must contain, e.g. `{ traffic_sign: 'DE:240' }`; may overwrite `traffic_sign=none`).
  - New `planTagVariantsForCategory`: the plan of `planTagsForCategory` first (`default`), then `with_sign` and `without_sign` (`traffic_sign=none` plus e.g. `segregated=no`) where a sign can settle the category.
  - New `categorySignOptions(categoryId)`: the signs that settle a category and whether it works without one.
  - Preferred tags for more macros: unsigned cycleway, footway with bicycles allowed (with `highway=footway` when the way is no footway or path), cycle lane, protected lane (`separation:left=bollard` or `traffic_mode:left=parking`), shared bus lanes, crossings.

- 408a3d6: A protected cycle lane (`cyclewayOnHighwayProtected`) can be planned on a line of its own: on `highway=cycleway` the planner adds `is_sidepath=yes` (new reason code `protected_lane_sidepath`) and the protection towards the road. `categoryGeometryMismatch` no longer reports `geometry_lane_needs_road` for it on `highway=cycleway`. On a road side the planner keeps `cycleway:<side>=lane` for a protected cycle lane instead of changing it to `track`.
- bdc668b: - Lengths and widths are read exactly like tilda-geo (`parse_length`, `parse_width`): the seven most common decimal commas (`2,5`, `0,5`, ...) are read, a negative length and `width=0` give no width, and only `cm`, `m` and `km` are converted.
  - New exports `parseLength` and `parseWidth` so editors can use the same parser.
- 529a9ce: - Riding direction follows tilda-geo-private#34 (not merged yet): `oneway=-1` and `oneway:bicycle=-1` are an explicit `oneway=yes` against the way, lanes and tracks on the road get `oneway=implicit_yes` when `cycleway:<side>:oneway` is missing, and `oneway:bicycle=no` with `oneway=-1` is `car_not_bike`.
  - New result fields `_lineReversed` (the published line runs against the OSM way) and `offset` (sideways offset of left and right lanes in meters, signed relative to the line).
  - `cycleway=opposite_lane|opposite_track` is read on `oneway=-1` roads too (mirrored) and gets an explicit `cycleway:<side>:oneway`; on a `oneway=-1` road the right side is `not_expected`; a separate way with `oneway=-1` uses `traffic_sign:backward`.
- 009ce1c: New `deriveRoadTodos` and `ROAD_TODOS`: the todos of a road (the way itself), ported from `road_todo_categories.lua`: `deprecated_cycleway_shared` and `unusual_width` (listed once per way: not again when the `self` bikelane row has it). Without `adjoining_of_vs_csv`, which needs the sidepath CSV. Fixtures in `schemas/bicycle-infrastructure-attributes/fixtures/road-todos`.
- 7ccdced: `deprecated_cycleway_shared` also reports `cycleway:both=shared`, `cycleway:left=shared` and `cycleway:right=shared`, as the tilda-geo processing does now. In the tagging package the finding names the key that is `shared`; the message has the new parameter `{key}`.
- c2c7cb3: - `highway=cycleway` with `traffic_sign=none` is a cycleway (`cycleway_adjoiningOrIsolated`, `cycleway_adjoining`, `cycleway_isolated`) instead of `needsClarification`, like tilda-geo. `highway=cycleway` without a `traffic_sign` stays `needsClarification`.
  - `analyzeCategoryGaps` names `traffic_sign=none` as a tag that settles a bare `highway=cycleway`.

### Patch Changes

- cc60760: `planTagsForCategory` now suggests `bicycle_road=yes` (and `vehicle=destination`) for the bicycle road categories instead of only reporting a `_category` conflict.
- 6ac4d17: `writeKeyForSide('cycleway', 'right', 'cycleway')` now returns `cycleway:right` (the road side itself) instead of `cycleway:right:cycleway`. The same holds for `sidewalk`. The planner and the gap keys use it, so plans for lanes and bus lanes no longer write `cycleway:right:cycleway`.

  `gapWriteKey` of the tagging package now simply calls it.

## 0.1.2

### Patch Changes

- Package is now ESM-only and publishable (dist via tsup, changesets release flow).
