---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

New package with the pure tagging logic of the iD Radnetz Berlin editor, built on `@tilda-geo/bicycle-infrastructure`:

- `pathRole(tags)`: one definition of foot and bicycle paths (centerline, one line, two lines). Part widths only with `segregated=yes`; a cycleway whose footway is a line of its own has no part widths.
- `planCategoryChange` / `planCategoryVariants` / `applyCategoryPlan` / `splitBothSides` / `categoryGeometryMismatch`: the category planner wrapper. Messages are codes with parameters.
- `requiredAttributes`, `roadAttributes`, `tildaQaState`, `reminders`: the requirement engine; the data of one dataset is a profile (`@tilda-geo/bicycle-infrastructure-tagging/profiles/radnetz-berlin`).
- Widths with the parser of the core (`width=150cm` is 1.5 m), part widths, `extractOptions` / `planExtraction` / `mergeSelection` with configurable offsets and tolerances, `cyclewayOnewayFindings`, labels and category groups as data.
- Differences to the iD fork, because the LUA processing wins: `parking=no` gives no traffic mode, a lane is protected only by the separation values of the core, and the riding direction on a road side is the one the core derives (the left side of a one-way road runs with the road).
