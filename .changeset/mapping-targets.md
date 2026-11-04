---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

Mapping targets: what a mapper picks in a "Change to" select.

- `MappingTarget` = TILDA category id (unchanged) + fixed tags + label code (de/en) + group. `MAPPING_TARGETS` is derived from the category specs: shared and segregated foot and cycle paths, cycleways and footways with bicycles allowed get a `signed` (DE:240 / DE:241 / DE:237 / DE:239,1022-10) and an `unsigned` target (`traffic_sign=none` + `segregated=no|yes` / `bicycle=yes`); the two-line cycleway (`highway=cycleway` + `traffic_mode:right=foot`) is a target of `footAndCyclewaySegregated_*`, as the LUA classifies it; every other category gets one target. Full list: `docs/mapping-targets.md`.
- Groups follow tilda-geo's map legend "Führungsform einfach": `MAPPING_TARGET_GROUPS`, `MAPPING_TARGET_GROUP_LABELS`, `groupMappingTargets`, `categoryMappingGroup`. `CATEGORY_GROUPS` of the iD fork stay.
- `planForMappingTarget(tags, targetId, side)` plans one target. `planCategoryVariants` returns the default plan first, then one plan per mapping target of the category; plans carry `mappingTargetId`, fixed tags have the code `mapping_target`.
- The planner follows the new core planner: no traffic sign is forced, `traffic_sign=none` is kept, `*_adjoining` sets `is_sidepath=yes`.
- `planCategoryChange` / `planCategoryVariants` now pass the side to `categoryGeometryMismatch`, which then also reports a path or lane category on a road's centerline, a bicycle road, link, crossing or between lanes on a road side, `*_isolated` on a road side and a two-line target on a road side. `categoryGeometryMismatch(tags, target)` without a side behaves as before.
- On a road side, foot and cycle paths get `cycleway:<side>=track`, footways with bicycles `sidewalk:<side>=yes`, `sharedBusLaneBikeWithBus` `cycleway:<side>=lane` when missing.
