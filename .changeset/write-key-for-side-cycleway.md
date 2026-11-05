---
'@tilda-geo/bicycle-infrastructure': patch
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

`writeKeyForSide('cycleway', 'right', 'cycleway')` now returns `cycleway:right` (the road side itself) instead of `cycleway:right:cycleway`. The same holds for `sidewalk`. The planner and the gap keys use it, so plans for lanes and bus lanes no longer write `cycleway:right:cycleway`.

`gapWriteKey` of the tagging package now simply calls it.
