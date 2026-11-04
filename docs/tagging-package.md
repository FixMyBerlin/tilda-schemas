# The tagging package

`@tilda-geo/bicycle-infrastructure-tagging` holds the pure tag logic that lived in the iD Radnetz Berlin fork (`/OSM/iD--radnetz-berlin`, branch `radnetz-mapping`). The core package stays the port of the LUA processing. The tagging package depends on the core, never the other way round.

## Where the fork files went

| Fork file                                                                 | Package                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `tilda/category_plan.ts`                                                  | `planner/category-plan.ts` (`planCategoryChange`, `planCategoryVariants`, ...)                    |
| `tilda/category_labels.ts`, `data/tilda_labels.de.json`, update script    | `labels/`, `scripts/update-labels.ts`                                                             |
| `tilda/required_attributes.ts`, `qa_state.ts`, `reminders.ts`             | `requirements/`; the dataset's data is `profiles/radnetz-berlin.ts`                               |
| `width/width_tags.ts`, `part_widths.ts`                                   | `widths/`                                                                                         |
| `sidepath/extract_tags.ts`, `merge_tags.ts`                               | `sidepath/`                                                                                       |
| `validations/cycleway_side_oneway.ts` (the pure `cyclewayOnewayFindings`) | `validations/cycleway-oneway.ts`, as rules in `validations/radnetz-rules.ts`                      |
| `validations/width_parts.ts`                                              | `validations/radnetz-rules.ts`; the whole rule system: [validation-rules.md](validation-rules.md) |
| three definitions of "foot and cycle path"                                | `path-role.ts`                                                                                    |

`planTagsForCategory` stays in the core (it needs the category specs; moving it would make the core depend on the tagging package for its re-export). The tagging package wraps it.

Stays in the fork: `checks.ts` (key-value DB), `width_indicator.ts`, `offset_line.ts`, `find_sidewalk.ts`, every iD validator and the UI sections.

## Where the package differs from the fork (LUA wins)

- `parking=no` gives no traffic mode (the fork said `no`).
- A lane to extract is protected only by what the core rates as `cyclewayOnHighwayProtected` (its set of `separation` values and `traffic_mode`), not by any `separation` other than `no`.
- Riding direction on a road side is `defaultSideRunsAgainstWay` of the core (follows tilda-geo-private#34, not merged yet). The left side of a one-way road runs with the road (`yes`, the fork's extraction said `-1`); the contraflow lane of a one-way road with `oneway:bicycle=no` is `-1` (the fork gave no direction); on a `oneway=-1` road both sides run against the way.
- Widths are read with `parseWidth` of the core: `width=150cm` is 1.5 m in extract and merge (the fork read 150 m), values the LUA cannot read are skipped.
- `pathRole` decides what a foot and cycle path is. A mode counts when it is `designated`, `yes` or `permissive`; a `highway=path` carries only what is tagged, unless the category says `footAndCycleway*`.
- Option lists (surface, separation, marking, traffic mode, surface colour) come from the sanitizers of the core.

## Planner: alternatives and variants

`planTagsForCategory` (core) reads the match of the target category (and of its refining child, e.g. `_adjoining`) from the category specs and expands it into alternatives: each alternative is a set of tags that is enough on its own. Every alternative becomes a candidate plan; the planner classifies the planned tags and keeps the cheapest candidate that gives the target. So:

- `segregated=yes` (with `bicycle` and `foot`) or `traffic_sign=DE:241` settles a segregated foot and cycle path; the plan never asks for both. Plans without a new traffic sign come first.
- `traffic_sign=none` (or `no`) is an observed fact and never overwritten. When one alternative already holds, no sign is added.
- Target `*_adjoining` changes `is_sidepath=no` to `yes`.
- Macros the classifier evaluates in code get preferred tags (`MACRO_PLAN_ALTERNATIVES`): bicycle road, unsigned cycleway, footway with bicycles allowed, cycle lane, protected lane, bus lanes, crossings. Between lanes stays without a plan: it needs the lane layout of the road.
- Option `fixed`: tags the plan must contain (bare keys, written for the side); a fixed `traffic_sign` may replace `none`.

`planTagVariantsForCategory` (core) returns the plan of `planTagsForCategory` first (`default`), then `with_sign` and `without_sign` where a sign can settle the category. `categorySignOptions` says which signs settle a category.

## Mapping targets

TILDA knows "shared foot and cycle path"; whether it is signed is an attribute. For mapping, "with sign 240" and "without sign" are two goals. A mapping target (`MappingTarget`) is a TILDA category (the id of tilda-geo, unchanged) plus the tags the plan must contain:

| Field             | What                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| `id`              | `categoryId` for `default`, else `<categoryId>:<variant>`                          |
| `categoryId`      | the TILDA category                                                                 |
| `variant`         | `default`, `signed`, `unsigned`, `twoLines`                                        |
| `fixed`           | tags the plan must contain (bare keys, e.g. `traffic_sign=none` + `segregated=no`) |
| `labelCode`       | key of `MAPPING_TARGET_LABELS.de` / `.en`                                          |
| `group`           | group of tilda-geo's legend                                                        |
| `separateWayOnly` | only for a way of its own (two lines), never for a road side                       |

How the list is derived (`MAPPING_TARGETS`, full table in [mapping-targets.md](mapping-targets.md)):

- Every category of `listTargetCategories` gets at least one target.
- A category that a traffic sign settles (`categorySignOptions`) and that also works without one gets `signed` (`traffic_sign=<sign>`) and `unsigned` (`traffic_sign=none` plus the tag that settles it on its own, read from the gap discriminators of `needsClarification`: `segregated=no`, `segregated=yes`, `bicycle=yes`). These are the shared and segregated foot and cycle paths, the cycleway and the footway with bicycles allowed.
- A Fahrradstraße exists only by its sign: `bicycleRoad` and `bicycleRoad_vehicleDestination` get one `default` target each (with and without `vehicle=destination` are two categories already).
- Hand-written: the two-line cycleway (`highway=cycleway` + `traffic_mode:right=foot`, footway as a line of its own). The LUA classifies it as `footAndCyclewaySegregated_*` (macro `foot_and_cycleway_segregated_separation`), so it is a target of that category, not of `cycleway_*` as the concept had it.
- Everything else gets one `default` target without fixed tags.

`planForMappingTarget(tags, targetId, side)` plans one target. `planCategoryVariants(tags, category, side)` returns the default plan first, then one plan per mapping target of the category (`variantId` = target id, `mappingTargetId` set); targets that do not fit the way are in the list with a conflict. A category with one plain target has one variant that names it. `planCategoryChange` is the first variant.

With a side, `categoryGeometryMismatch` also checks road centerline against road side: a path or lane category on the centerline of a road (`geometry_path_needs_road_side`, `geometry_lane_needs_road_side`), a bicycle road, link, crossing or between lanes on a road side (`geometry_not_a_road_side`), `*_isolated` on a road side (`geometry_isolated_not_a_road_side`), a two-line target on a road side (`geometry_needs_separate_way`). Without a side only the rules that hold for any side apply, as before.

### Groups

The groups follow the legend "Führungsform einfach" of tilda-geo (`subcat_bikelanes.const.ts`, category lists from `layers/bikelanes_default.ts`): `separated`, `lane`, `foot`, `sidewalk`, `mixed`, `needsClarification` (no targets). German names are tilda-geo's, English ones ours (`MAPPING_TARGET_GROUP_LABELS`).

Differences to the groups of the iD fork (`CATEGORY_GROUPS`, kept for the fork):

| Fork group     | Categories go to (tilda-geo legend)                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `track`        | `separated`                                                                                                          |
| `lane`         | `lane`, except `cyclewayOnHighwayProtected` (`separated`) and `sharedMotorVehicleLane` (`mixed`)                     |
| `foot`         | split: shared paths → `foot`; segregated paths → `separated`; footway with bicycles and pedestrian zone → `sidewalk` |
| `bus`          | `mixed`                                                                                                              |
| `bicycle_road` | split: `bicycleRoad` → `separated`, `bicycleRoad_vehicleDestination` → `mixed`                                       |
| `special`      | `lane` (`cyclewayLink`, `crossing`)                                                                                  |
| (none)         | new: `sidewalk`, `mixed`, `needsClarification`                                                                       |

### Round trip

`test/mapping-targets.test.ts` runs every mapping target against a generated matrix of start cases (`test/round-trip-cases.ts`): ways of their own (`path`, `footway`, `cycleway`, `pedestrian`, `residential`) × `traffic_sign` (unset, `none`, `DE:240`, `DE:241`) × `segregated` (unset, `yes`, `no`) × `is_sidepath` (unset, `yes`, `no`), and the right side of a `secondary` × `cycleway:right` (unset, `track`, `lane`, `no`) × the same sign and `segregated` values on that side. For each: plan → apply → `processBikelanes`; the category must be the target, the fixed tags present and `traffic_sign=none` untouched unless the target fixes a sign. Combinations the planner cannot reach are listed in `EXPECTED_UNREACHABLE` with a reason (and must then report a conflict); a rule that applies to no case fails the test.

## Open

- `cyclewayOnHighwayBetweenLanes` has a mapping target but no plan: it needs the lane layout of the road.
- The planner adds and changes tags, it does not remove them: a protected lane with `segregated` on the side, or a lane with a DE:240 / DE:241 sign on the side, stays out of reach.
