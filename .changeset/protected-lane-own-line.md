---
'@tilda-geo/bicycle-infrastructure': minor
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

A protected cycle lane (`cyclewayOnHighwayProtected`) can be planned on a line of its own: on `highway=cycleway` the planner adds `is_sidepath=yes` (new reason code `protected_lane_sidepath`) and the protection towards the road. `categoryGeometryMismatch` no longer reports `geometry_lane_needs_road` for it on `highway=cycleway`. On a road side the planner keeps `cycleway:<side>=lane` for a protected cycle lane instead of changing it to `track`.
