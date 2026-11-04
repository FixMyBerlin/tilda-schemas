# The tagging package

`@tilda-geo/bicycle-infrastructure-tagging` holds the pure tag logic that lived in the iD Radnetz Berlin fork (`/OSM/iD--radnetz-berlin`, branch `radnetz-mapping`). The core package stays the port of the LUA processing. The tagging package depends on the core, never the other way round.

## Where the fork files went

| Fork file                                                                 | Package                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `tilda/category_plan.ts`                                                  | `planner/category-plan.ts` (`planCategoryChange`, `planCategoryVariants`, ...) |
| `tilda/category_labels.ts`, `data/tilda_labels.de.json`, update script    | `labels/`, `scripts/update-labels.ts`                                          |
| `tilda/required_attributes.ts`, `qa_state.ts`, `reminders.ts`             | `requirements/`; the dataset's data is `profiles/radnetz-berlin.ts`            |
| `width/width_tags.ts`, `part_widths.ts`                                   | `widths/`                                                                      |
| `sidepath/extract_tags.ts`, `merge_tags.ts`                               | `sidepath/`                                                                    |
| `validations/cycleway_side_oneway.ts` (the pure `cyclewayOnewayFindings`) | `validations/cycleway-oneway.ts`                                               |
| three definitions of "foot and cycle path"                                | `path-role.ts`                                                                 |

`planTagsForCategory` stays in the core (it needs the category specs; moving it would make the core depend on the tagging package for its re-export). The tagging package wraps it.

Stays in the fork: `checks.ts` (key-value DB), `width_indicator.ts`, `offset_line.ts`, `find_sidewalk.ts`, every iD validator and the UI sections.

## Where the package differs from the fork (LUA wins)

- `parking=no` gives no traffic mode (the fork said `no`).
- A lane to extract is protected only by what the core rates as `cyclewayOnHighwayProtected` (its set of `separation` values and `traffic_mode`), not by any `separation` other than `no`.
- Riding direction on a road side is `defaultSideRunsAgainstWay` of the core (follows tilda-geo-private#34, not merged yet). The left side of a one-way road runs with the road (`yes`, the fork's extraction said `-1`); the contraflow lane of a one-way road with `oneway:bicycle=no` is `-1` (the fork gave no direction); on a `oneway=-1` road both sides run against the way.
- Widths are read with `parseWidth` of the core: `width=150cm` is 1.5 m in extract and merge (the fork read 150 m), values the LUA cannot read are skipped.
- `pathRole` decides what a foot and cycle path is. A mode counts when it is `designated`, `yes` or `permissive`; a `highway=path` carries only what is tagged, unless the category says `footAndCycleway*`.
- Option lists (surface, separation, marking, traffic mode, surface colour) come from the sanitizers of the core.

## Open

See the report of the session that ported it and the changeset. Variants of the planner (with / without sign) and mapping targets follow; `planCategoryVariants` already returns a list.
