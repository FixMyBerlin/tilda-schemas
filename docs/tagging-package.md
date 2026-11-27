# The tagging package

`@tilda-geo/bicycle-infrastructure-tagging` holds the pure tag logic that lived in the iD Radnetz Berlin fork (`/OSM/iD--radnetz-berlin`, branch `radnetz-mapping`). The core package stays the port of the LUA processing. The tagging package depends on the core, never the other way round.

## Where the fork files went

| Fork file                                                                 | Package                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `tilda/category_plan.ts`                                                  | `planner/category-plan.ts` (`planCategoryChange`, `planForMappingChoice`, ...)                    |
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
- Riding direction on a road side is `defaultSideRunsAgainstWay` of the core (tilda-geo `6ec40d600`, the wiki default). The left side of a one-way road runs with the road (`yes`, the fork's extraction said `-1`), also with `oneway:bicycle=no`: a contraflow lane needs an explicit `cycleway:left:oneway=-1`; on a `oneway=-1` road both sides run against the way; a roundabout is a one-way road. A road side that TILDA reads as both ways (`assumed_no`: a track with no cycling infrastructure on the other side, tilda-geo PR 424, or a service road) gets no default: the oneway row is a guess the mapper confirms. `cycleway_oneway_redundant` never flags the direction of a track: there it also says "not both ways". The oneway row offers values by context, each with its meaning (`optionMeanings`, `optionMeaningText`; from Maid, `docs/upstream/tilda-tagging-oneway-options.md`): a way of its own `yes` and `no`, never `-1` (reverse the way instead); a road side its default and `no`, plus `yes` on the left of a two-way road and the contraflow value on a one-way road open to bicycles.
- Line direction of a way of its own next to its road (from the infravelo-radnetz batch check of Berlin, 2026-11): `lineRelationToRoad(way, road)` says on which side of the road line the way lies and whether its line runs with the traffic on that side (`sideOnewayDefault`) or against it. Points every 5 m vote that lie 0.5–25 m from the road and run parallel to it (under 30°); at least 3 votes and 80 % agreement, else no answer (short pieces at junctions). No answer at roundabouts and on the left of a one-way road (the median of a dual carriageway, or a path open against the one-way). `pickSidepathRoad(way, roads)` picks the road out of the roads near the way: first one with `cycleway:<side>|both=separate` (or `cycleway=separate`) on the side the way lies on, then `sidewalk:<side>|both=separate` or `sidewalk:bicycle:<side>|both=separate`, then the nearest; the nearest alone is often a service road between path and carriageway, or a parallel one-way street. `sidepathDirectionFindings(way, roads)` runs the rule `sidepath_line_against_traffic` with that (`ValidationOptions.lineRelation`): `yes` whose line runs against the traffic; the fix reverses the way and keeps `yes`. `RequirementOptions.lineRelation` turns the meaning of `yes` on a way of its own into `with_line_with_traffic` or `with_line_against_traffic`. The editor only finds the roads near the way.
- Bike lane out of a segregated path (a mapper's report, 2026-11): a way tagged as a segregated foot and cycle path that is really a sidewalk next to a bike lane on the carriageway. `canPlanLaneFromSegregatedPath(tags)` (one line, `segregated=yes`, no crossing); `planLaneFromSegregatedPath(path, road, { roadSide, pathAlongRoad, target, lane })` gives the sidewalk (`highway=footway` + `footway=sidewalk`, `footway:*` → `*`), and the lane as a line of its own (`highway=cycleway` + `cycleway=lane` + `lane=exclusive|advisory`, drawn in the road's direction, `cycleway:*` → `*`) or on the road (`cycleway:<side>=lane`, `:oneway` only where it differs from the default). `wayPlacement(way, road)` gives side and drawing direction. The traffic sign, a width of the whole path and `bicycle=use_sidepath` on the road are not guessed but listed in `review`. A plain lane extracted from the road as a line (`planExtraction`) is now `cycleway=lane` with its `lane=*` too, no longer a cycle track.
- Crossings (fork commits `eaa217bcb`, `0b23d217b`, `6c9b8834f`, `d463a3b3b`): a side marked as a crossing (`cycleway:<side>:track=crossing` or `:lane=crossing`, also `:both:` or without a side, `isCrossingSide`) or extracted with `asCrossing` gives the new way `<class>=crossing` (`cycleway=crossing`, `path=crossing`) and no `is_sidepath`. `extractOptions(tags, { plainLanes: true })` also offers plain bike lanes, as a line and as a crossing; `extractAndMergeSides` never includes lanes or crossings. `combinedPathTags` turns a foot crossing and a bike crossing into `path=crossing` (or `path=traffic_island`), without `is_sidepath`.
- `reverseTags` (used by `applyTagFix` for `reverseWay`, and by editors to extract or merge sidepaths) is the "redraw" model: the line is drawn the other way, nothing changes in the real world (Maid `docs/research/reverse-side-keys.md`, 2026-11-27). `forward`/`backward` swap and `oneway` values relative to the line turn (`yes` ↔ `-1`). On a road side (`cycleway:<side>…`, `sidewalk:<side>…`, `parking:<side>…`) only the side of the road swaps; a second side (`cycleway:right:separation:left`, `cycleway:both:marking:left`) is read in the lane's riding direction (Proposal:Separation, tilda-geo `e9dc145`) and stays. On a way of its own, `separation`, `marking`, `buffer` and `traffic_mode` sides stay when the way is one-way for bicycles and swap when it is two-way. The fork swapped every `left`/`right`.
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
- A road side (`side: 'left' | 'right'`) is planned completely, also when it has no tags yet: `cycleway:both` (or `cycleway`) is split into the two sides (`remove` lists it), `cycleway:<side>` gets the value the category needs (`lane`, `track`, `shared_lane`, …), a footway category sets `sidewalk:<side>`. Every key goes under `cycleway:<side>:` (or `sidewalk:<side>:`); `highway` and other keys of the road are never touched. A side can have two objects (`cycleway:right` and `sidewalk:right`); the planner works on the one the category lives on.

`planTagVariantsForCategory` (core) returns the plan of `planTagsForCategory` first (`default`), then `with_sign` and `without_sign` where a sign can settle the category. `categorySignOptions` says which signs settle a category.

## Mapping choices

TILDA knows "shared foot and cycle path"; whether it is signed, under construction or mapped as two lines are attributes or mapping styles of the same infrastructure. A flat list of every combination ("…, signed", "…, unsigned", "…, under construction", "…, signed, under construction") hides that they are independent. So a mapper picks a kind and sets options (`MappingChoice`):

| Field       | Values                               | What it is                    | Offered                                                                                                                                             |
| ----------- | ------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`      | `MAPPING_KINDS`                      | the infrastructure            | always                                                                                                                                              |
| `position`  | `adjoining`, `isolated`              | part of the TILDA category id | paths (cycleway, shared and segregated foot and cycle path, footway with bicycles allowed) on a way of their own; a road side is always `adjoining` |
| `sign`      | (as it is), `signed`, `unsigned`     | `traffic_sign`                | categories a sign settles that also work without one, not under construction (signs are mapped once they hang)                                      |
| `lines`     | (one line), `two`                    | mapping style                 | the segregated foot and cycle path on a way of its own                                                                                              |
| `lifecycle` | (built), `construction`, `temporary` | `lifecycle` of tilda-geo      | `construction` for every kind, `temporary` for lanes, the protected lane, foot and cycle paths and footways with bicycles allowed                   |

- `MAPPING_KINDS` comes from `listTargetCategories`: a category is a kind, the two categories `<path>_adjoining` and `<path>_isolated` are one kind. German kind names come from tilda-geo's labels.
- `mappingOptionRows(choice, side, lang)` gives the rows a form shows, with labels and the current value (iD and the viewer draw these). `mappingChoiceOptions(choice, side)` lists the values of each option for that side and choice; `normalizeMappingChoice` drops the values that are not offered; `resolveMappingChoice` gives the TILDA category, the tags the plan must contain (`fixed`) and the lifecycle; `mappingChoiceId` writes a choice as `footAndCyclewaySegregated:isolated:unsigned:two:construction`; `mappingChoiceLabel` names it.
- `signed` writes the sign of the category (`traffic_sign=DE:241`); `unsigned` writes `traffic_sign=none` plus the tag that settles the category on its own, read from the gap discriminators of `needsClarification` (`segregated=no`, `segregated=yes`, `bicycle=yes`). A Fahrradstraße exists only by its sign: no sign option.
- `two` lines writes `highway=cycleway` + `traffic_mode:right=foot`: the cycleway line with the footway as a line of its own. The LUA classifies it as `footAndCyclewaySegregated_*` (macro `foot_and_cycleway_segregated_separation`).
- `construction` writes a way of its own as `highway=construction` + `construction=<highway>` and moves the side key of a road side under the prefix (`construction:cycleway:right=lane`). `temporary` writes `temporary=yes` for the side (`cycleway:right:temporary=yes`, `sidewalk:right:temporary=yes`), as tilda-geo reads it since `08b1428b5`. A plan only counts when the side gets that lifecycle (`lifecycleForSide`). An existing lifecycle wins in tilda-geo, so `temporary` on a way under construction is the conflict `lifecycle_not_reached`.

`planForMappingChoice(tags, choice, side)` plans one choice (`choiceId` on the plan). `planCategoryChange(tags, category, side)` is the plan of the plain choice: fewest edits, no new traffic sign, `traffic_sign=none` kept. The full table of kinds, options and choices is in [mapping-targets.md](mapping-targets.md).

### Groups

The groups follow the legend "Führungsform einfach" of tilda-geo (`subcat_bikelanes.const.ts`, category lists from `layers/bikelanes_default.ts`): `separated`, `lane`, `foot`, `sidewalk`, `mixed`, `needsClarification` (no targets). A road side also gets the group `separateWay` with `SEPARATE_KIND` (`groupMappingKinds(side)`): "Separat geführt (eigene Linie)" plans `cycleway:<side>=separate` and removes the side's sub keys, as the extraction does. German names are tilda-geo's, English ones ours (`MAPPING_TARGET_GROUP_LABELS`).

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

`test/mapping-targets.test.ts` runs every mapping choice (`allMappingChoices`) against a generated matrix of start cases (`test/round-trip-cases.ts`): ways of their own (`path`, `footway`, `cycleway`, `pedestrian`, `residential`) × `traffic_sign` (unset, `none`, `DE:240`, `DE:241`) × `segregated` (unset, `yes`, `no`) × `is_sidepath` (unset, `yes`, `no`), and the right side of a `secondary` × `cycleway:right` (unset, `track`, `lane`, `no`) × the same sign and `segregated` values on that side. For each: plan → apply → `processBikelanes`; the category and the lifecycle must be the choice's, the fixed tags present and `traffic_sign=none` untouched unless the target fixes a sign. Combinations the planner cannot reach are listed in `EXPECTED_UNREACHABLE` with a reason (and must then report a conflict); a rule that applies to no case fails the test.

## Profiles

A profile (`RequirementsProfile`) says what belongs to one dataset. Two ship with the package:

| Profile                           | For                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `profiles/radnetz-berlin`         | The infraVelo Radnetz dataset: feeds per tag, damage signs, width sources, reminders, part widths |
| `profiles/tilda-geo` (`tildaGeo`) | TILDA itself: only the attributes the processing reads, no dataset                                |

`tildaGeo` is the profile for "Pflichtangaben" without a dataset. It asks for what `extract_bikelanes.lua` exports (`width`, `source:width`, `width:effective`, `surface` with `sett:length`, `surface:colour`, `oneway` with `oneway:bicycle`, `traffic_sign`, `separation` / `traffic_mode` / `marking` / `buffer` per side) and for the tags that decide the category (`is_sidepath`, `segregated`, `lane`, `cycleway`, `traffic_mode:right=foot`). On a one-way road it also asks for `dual_carriageway`, as optional: TILDA does not read it, but it is good to know. Compared to the Radnetz profile it leaves out, because TILDA does not read them:

- the width, width source and colour of a part of a segregated foot and cycle path (`cycleway:width`, `source:cycleway:width`, `cycleway:surface:colour`): the whole way has one `width` and one `surface:colour` (`partWidths: false`),
- the reminders (damage signs, barriers), the damage signs as `traffic_sign` options, the `feeds` and the skipped `cyclewayLink`.

The traffic signs offered are the ones the category specs settle a category with (`categorySignOptions`) and `none` where a category works without a sign. The profile fields `skipAttributes` and `partWidths` are new; a profile without them behaves as before.

## Texts

The package brings German and English texts as data, so an app (or an editor with its own localizer) does not write them. Every table is `{ de, en }`, `{placeholders}` are filled from the parameters, and a test checks that every code, id and state has both languages.

| What                            | Export                                                                                      | Source                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Validation rules and fixes      | `MESSAGES`, `renderMessage`, `RULE_DESCRIPTIONS`, `ruleDescription`                         | written for the package                                           |
| Plan conflicts and plan reasons | `PLAN_MESSAGES`, `renderPlanConflict`, `renderPlanReason` (core: `reasonCode`)              | written for the package                                           |
| Attribute labels, notes, hints  | `ATTRIBUTE_LABELS`, `ATTRIBUTE_NOTES`, `ATTRIBUTE_HINTS`, `attributeLabel`, `attributeNote` | iD fork `inspector.tilda.*`, copied                               |
| Reminders                       | `REMINDER_TEXTS`, `reminderText`                                                            | iD fork, copied                                                   |
| QA states, attribute states     | `QA_STATE_LABELS`, `ATTRIBUTE_STATE_LABELS`, `ATTRIBUTE_STATE_TEXTS`                        | QA: words of the fork's lens tooltip; short state labels: written |
| Categories                      | `TILDA_LABELS.de`, `categoryLabel` (also the base categories, `footAndCyclewaySegregated`)  | tilda-geo (topic docs and the legend); German only                |

Plan entries carry the core's English `reason` and a stable `reasonCode` (`required_for_category`, `bicycle_road_sign`, ...); the text is `category_requirement.<reasonCode>` in `PLAN_MESSAGES`. Pass `categoryLabels: TILDA_LABELS.de` to name categories by their label.

## Gaps

`analyzeCategoryGaps` (core) says which tags would make an incomplete category exact (`gap.key`, `gap.values`, `gap.unlocksCategory`). `gapWriteKey(gap, result)` and `gapTags(gap, result, value)` give the OSM key and the tag for a road side. Both use the core's `writeKeyForSide`: `lane` is written as `cycleway:right:lane`, and the gap `cycleway` (`track`, `lane`) on a road side as `cycleway:right`.

## Open

- `cyclewayOnHighwayBetweenLanes` is a mapping kind but has no plan: it needs the lane layout of the road.
- The planner adds and changes tags, it does not remove them: a protected lane with `segregated` on the side, or a lane with a DE:240 / DE:241 sign on the side, stays out of reach.
