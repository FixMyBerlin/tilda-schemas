# @tilda-geo/bicycle-infrastructure-tagging

## 0.2.0

### Minor Changes

- 883ccb4: A sidewalk where bicycles are only allowed ("Radfahrer frei": `highway=footway` + `bicycle=yes|permissive`, or `highway=path` + `foot=designated` + `bicycle=yes`, TILDA `footwayBicycleYes`) is now the foot line in `pathRole` (`part: 'foot'`), not one line for both modes. `partKind` finds it as the foot part for merging again, and `partWidthMode` offers no part widths on it.
- a86f0ff: `oneway:bicycle` in the editor helpers:

  - `reverseTags` now flips every `oneway` value that refers to the drawing direction (`oneway:bicycle`, `cycleway:<side>:oneway`, …), not only `oneway`.
  - On a way of its own, the oneway attribute is about `oneway:bicycle` when that tag is there, because TILDA reads it first. A tagged `oneway` next to it shows up in the new field `RequiredAttribute.unused`, and `attributeNote` says "… ist auch getaggt, wird aber nicht beachtet".

- 1568c56: - On `highway=footway|path`, the oneway attribute now always writes `oneway:bicycle`. Pedestrians are never one-way, but `oneway:bicycle` says that explicitly. A plain `oneway` is still read, as TILDA does.
  - `unexpected_oneway_direction` now has a message per case: `.left_with`, `.right_against`, `.both_with` and `.both_against`. Each says what the tagged value means for that side, what the default is, and when the tag is still right. Source: [Key:cycleway:right:oneway](https://wiki.openstreetmap.org/wiki/Key:cycleway:right:oneway) and its German page.

## 0.1.1

### Patch Changes

- 503c8c3: 0.1.0 was published with `"@tilda-geo/bicycle-infrastructure": "workspace:*"` and could not be installed with npm. 0.1.1 depends on `@tilda-geo/bicycle-infrastructure` 0.2.0.

## 0.1.0

### Minor Changes

- 442a95f: New package with the pure tagging logic of the iD Radnetz Berlin editor, built on `@tilda-geo/bicycle-infrastructure`:

  - `pathRole(tags)`: one definition of foot and bicycle paths (centerline, one line, two lines). Part widths only with `segregated=yes`; a cycleway whose footway is a line of its own has no part widths.
  - `planCategoryChange` / `planCategoryVariants` / `applyCategoryPlan` / `splitBothSides` / `categoryGeometryMismatch`: the category planner wrapper. Messages are codes with parameters.
  - `requiredAttributes`, `roadAttributes`, `tildaQaState`, `reminders`: the requirement engine; the data of one dataset is a profile (`@tilda-geo/bicycle-infrastructure-tagging/profiles/radnetz-berlin`).
  - Widths with the parser of the core (`width=150cm` is 1.5 m), part widths, `extractOptions` / `planExtraction` / `mergeSelection` with configurable offsets and tolerances, `cyclewayOnewayFindings`, labels and category groups as data.
  - Differences to the iD fork, because the LUA processing wins: `parking=no` gives no traffic mode, a lane is protected only by the separation values of the core, and the riding direction on a road side is the one the core derives (the left side of a one-way road runs with the road).

- b9e2960: `gapWriteKey(gap, result)` and `gapTags(gap, result, value)` give the OSM key and the tag that answer a gap of `analyzeCategoryGaps` for one road side (`lane` → `cycleway:right:lane`, and the gap `cycleway` → `cycleway:right`, which the core's `writeKeyForSide` alone would write as `cycleway:right:cycleway`). `TILDA_LABELS.de` now also has the base categories that the gaps unlock without a suffix (`category=footAndCyclewaySegregated`, `footAndCyclewayShared`, `cycleway`, `footwayBicycleYes`), taken from the legend of tilda-geo.
- 3cfdb4d: The packages are now licensed under ISC (before AGPL-3.0-or-later), and the tarballs contain the license text and a notice: the logic is ported from the LUA processing of tilda-geo (AGPL-3.0), whose rights holder FixMyCity GmbH publishes it here under ISC. Text and schemas of the repository are CC BY 4.0.
- da0b384: The results of `processBikelanes` have `lifecycle` (`construction`, `construction_no_access`, `blocked`, `temporary`): the side's own, else the one of its road, as in tilda-geo. `temporary=yes` and `cycleway|sidewalk[:<side>]:temporary=yes` are read as `lifecycle=temporary` (tilda-geo `08b1428b5`), and `construction:cycleway=*` without a side counts for the cycleway, not the road (`4138bc51f`).

  `planTagsForCategory` takes the option `lifecycle` (`construction` or `temporary`). The tagging package has mapping targets `<category>:construction` for every category and `<category>:temporary` for lanes, the protected lane, foot and cycle paths and footways with bicycles allowed, the helpers `lifecycleForSide` and `isPlainMappingTarget`, and the conflict `lifecycle_not_reached`.

- 15a895c: Mapping targets become mapping choices: a kind of infrastructure (`MAPPING_KINDS`; the paths are one kind each instead of `_adjoining` and `_isolated`) plus options that do not exclude each other: `position`, `sign`, `lines`, `lifecycle`. `mappingChoiceOptions(choice, side)` says which options a kind offers (no sign under construction, no position and no second line on a road side, `temporary` only for some kinds); `mappingOptionRows` (the rows a form shows, with labels), `resolveMappingChoice`, `normalizeMappingChoice`, `mappingChoiceId`, `mappingChoiceLabel`, `mappingKindLabel`, `mappingChoiceForCategory`, `groupMappingKinds`, `allMappingChoices` and `MAPPING_OPTION_LABELS` go with it. `planForMappingChoice(tags, choice, side)` replaces `planForMappingTarget`; plans carry `choiceId` instead of `variantId` / `mappingTargetId`. Removed: `MAPPING_TARGETS`, `MAPPING_TARGET_LABELS`, `mappingTargetById`, `mappingTargetLabel`, `mappingTargetsForCategory`, `groupMappingTargets`, `isPlainMappingTarget`, `planCategoryVariants`, the types `MappingTarget` and `MappingTargetVariant`, and the conflict `unknown_mapping_target` (now `unknown_mapping_kind`).
- dba9f01: Mapping targets: what a mapper picks in a "Change to" select.

  - `MappingTarget` = TILDA category id (unchanged) + fixed tags + label code (de/en) + group. `MAPPING_TARGETS` is derived from the category specs: shared and segregated foot and cycle paths, cycleways and footways with bicycles allowed get a `signed` (DE:240 / DE:241 / DE:237 / DE:239,1022-10) and an `unsigned` target (`traffic_sign=none` + `segregated=no|yes` / `bicycle=yes`); the two-line cycleway (`highway=cycleway` + `traffic_mode:right=foot`) is a target of `footAndCyclewaySegregated_*`, as the LUA classifies it; every other category gets one target. Full list: `docs/mapping-targets.md`.
  - Groups follow tilda-geo's map legend "Führungsform einfach": `MAPPING_TARGET_GROUPS`, `MAPPING_TARGET_GROUP_LABELS`, `groupMappingTargets`, `categoryMappingGroup`. `CATEGORY_GROUPS` of the iD fork stay.
  - `planForMappingTarget(tags, targetId, side)` plans one target. `planCategoryVariants` returns the default plan first, then one plan per mapping target of the category; plans carry `mappingTargetId`, fixed tags have the code `mapping_target`.
  - The planner follows the new core planner: no traffic sign is forced, `traffic_sign=none` is kept, `*_adjoining` sets `is_sidepath=yes`.
  - `planCategoryChange` / `planCategoryVariants` now pass the side to `categoryGeometryMismatch`, which then also reports a path or lane category on a road's centerline, a bicycle road, link, crossing or between lanes on a road side, `*_isolated` on a road side and a two-line target on a road side. `categoryGeometryMismatch(tags, target)` without a side behaves as before.
  - On a road side, foot and cycle paths get `cycleway:<side>=track`, footways with bicycles `sidewalk:<side>=yes`, `sharedBusLaneBikeWithBus` `cycleway:<side>=lane` when missing.

- 3621d9c: German and English texts for the planner: `PLAN_MESSAGES` holds a text for every plan conflict code (`PLAN_CONFLICT_CODES`) and every reason code (`PLAN_REASON_CODES`, and the stable `reasonCode` of the core for `category_requirement`). `renderPlanReason(entry, lang)` and `renderPlanConflict(conflict, lang)` fill the placeholders, and name categories by their label when you pass `categoryLabels: TILDA_LABELS.de`. Plan entries now carry the core's `reasonCode`; the `tags_not_enough` and `no_suggestion` conflicts carry `params.target` and `params.result`.
- 7ec6d4c: `planTagsForCategory` plans a road side completely, also when the side has no tags yet. Before, it wrote bare keys on the road (`cycleway=lane`, `lane=exclusive`) and even suggested `highway=cycleway`; only the tagging package's wrapper hid this.

  - The plan has a new field `remove`: `cycleway:both` (or `cycleway`) when it is split into `cycleway:left` and `cycleway:right`.
  - `cycleway:<side>` gets the value the category needs, a footway category sets `sidewalk:<side>`. New reason codes `split_both_sides` and `side_presence`.
  - On a road side the planner never changes `highway`. Of the two objects of a side (`cycleway:right`, `sidewalk:right`) it works on the one the category lives on.
  - `writeKeyForSide` without a prefix writes under `cycleway:<side>`.

  Tagging package: the wrapper uses this and drops its own side handling. `splitBothSides` is removed. `categoryForSide` takes the target category as an optional third argument to read the right object of a side.

- 408a3d6: A protected cycle lane (`cyclewayOnHighwayProtected`) can be planned on a line of its own: on `highway=cycleway` the planner adds `is_sidepath=yes` (new reason code `protected_lane_sidepath`) and the protection towards the road. `categoryGeometryMismatch` no longer reports `geometry_lane_needs_road` for it on `highway=cycleway`. On a road side the planner keeps `cycleway:<side>=lane` for a protected cycle lane instead of changing it to `track`.
- 517187e: German and English texts for the required attributes, copied from the iD Radnetz Berlin editor: `ATTRIBUTE_LABELS` (a label for every attribute id, `ATTRIBUTE_IDS` lists them), the notes and hints (`ATTRIBUTE_NOTES`, `ATTRIBUTE_HINTS`), the reminders (`REMINDER_TEXTS`, title and text), the QA states (`QA_STATE_LABELS`) and the attribute states (`ATTRIBUTE_STATE_LABELS`, `ATTRIBUTE_STATE_TEXTS`). Helpers: `attributeLabel`, `attributeNote` (the sentence below an attribute: what TILDA makes of the tag, what a missing tag means), `attributeHint`, `attributeFeedsText`, `reminderText`, `qaStateLabel`, `attributeStateLabel`.
- fc97852: `RULE_DESCRIPTIONS` and `ruleDescription(ruleId, lang)` give a plain description of every validation rule in German and English, without placeholders. For a catalogue of all rules, where most rules have no finding and so no message with values.
- 7ccdced: `deprecated_cycleway_shared` also reports `cycleway:both=shared`, `cycleway:left=shared` and `cycleway:right=shared`, as the tilda-geo processing does now. In the tagging package the finding names the key that is `shared`; the message has the new parameter `{key}`.
- 03d0fcc: New profile `@tilda-geo/bicycle-infrastructure-tagging/profiles/tilda-geo` (`tildaGeo`): the required attributes TILDA itself reads, without a dataset (no infraVelo feeds, no reminders, one width for the whole of a segregated path). `RequirementsProfile` gets the optional fields `skipAttributes` and `partWidths` (default `true`, the Radnetz behaviour).
- 2de4437: Validation rules for editors, in the subpath `@tilda-geo/bicycle-infrastructure-tagging/validation` (and the root): `validateTags(tags, options)` returns findings, `RULES` is the catalogue, `MESSAGES` and `renderMessage` give the texts in German and English, `applyTagFix` applies a fix. A rule has an id, severity, source, scope, keys and a message code with parameters; a finding adds its fixes as tag changes. 21 rules wrap the todos of tilda-geo (`processBikelanes` and `deriveRoadTodos`), 5 come from the iD Radnetz Berlin editor (part widths that do not add up, are as wide as the whole way or exist on `segregated=no`, and `cycleway:*:oneway` findings) and run with `profile: 'radnetz-berlin'`. See docs/validation-rules.md.
- d9d9351: `width_part_whole` is an `error` now and also applies with `segregated=no`: a part width as wide as the whole path (`highway=path` + `width=1` + `cycleway:width=1`) never makes sense. With `segregated=no` it replaces `width_part_unsegregated` for that way, so there is still one finding.

### Patch Changes

- ad544b0: When the planner splits `cycleway:both` (or `cycleway`) into the two sides, it moves the sub-keys too (`cycleway:both:lane=advisory` → `cycleway:left:lane=advisory` and `cycleway:right:lane=advisory`), so the way keeps one scheme. A footway with bicycles allowed on a road side no longer splits the cycleway of the road. New export `categorySidePrefix(categoryId)`: the prefix of the road side object a category lives on (`sidewalk` or `cycleway`); the tagging package uses it.
- 74c9759: Merged foot and cycle paths get the exact sum of the part widths, so they no longer trigger `width_part_sum`. `width_part_sum` no longer checks roads, where `width` is the carriageway. `pathRole` counts an untagged mode on a `highway=path` whose category is for both modes.
- 6ac4d17: `writeKeyForSide('cycleway', 'right', 'cycleway')` now returns `cycleway:right` (the road side itself) instead of `cycleway:right:cycleway`. The same holds for `sidewalk`. The planner and the gap keys use it, so plans for lanes and bus lanes no longer write `cycleway:right:cycleway`.

  `gapWriteKey` of the tagging package now simply calls it.

- Updated dependencies [cc60760]
- Updated dependencies [163ed67]
- Updated dependencies [be35255]
- Updated dependencies [0815bef]
- Updated dependencies [3cfdb4d]
- Updated dependencies [da0b384]
- Updated dependencies [f45a2fa]
- Updated dependencies [7d1aad9]
- Updated dependencies [7ec6d4c]
- Updated dependencies [ad544b0]
- Updated dependencies [ca9be72]
- Updated dependencies [408a3d6]
- Updated dependencies [bdc668b]
- Updated dependencies [529a9ce]
- Updated dependencies [009ce1c]
- Updated dependencies [7ccdced]
- Updated dependencies [c2c7cb3]
- Updated dependencies [6ac4d17]
  - @tilda-geo/bicycle-infrastructure@0.2.0
