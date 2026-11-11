---
'@tilda-geo/bicycle-infrastructure': minor
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

The riding direction follows tilda-geo `develop` (`6ec40d600`, `bac701775`) instead of the branch of tilda-geo-private#34:

- `1` and `true` are read as `yes` for `oneway`, `oneway:bicycle` and `cycleway|sidewalk:<side>:oneway` (`normalizeOnewayTags`). A roundabout is a one-way road: both sides follow it, the left side is `not_expected`.
- A lane or track tagged on the road without `cycleway:<side>:oneway`: the category decides its `oneway`. Lanes and `shared_lane` are `implicit_yes` (`sharedMotorVehicleLane` has `implicitOneWay` now, tilda-geo `0927094ca`); tracks and shared paths are `assumed_no`. The line direction still follows the side.
- On a one-way road with `oneway:bicycle=no` an untagged left lane follows the road. A contraflow lane needs `cycleway:left:oneway=-1` (or `cycleway=opposite_lane`). `defaultSideRunsAgainstWay` follows, so extracting such a side writes `oneway=yes`.
- `_lineReversed` is `false` for lines of the way itself, also with `oneway=-1`.
- `unexpected_oneway_direction` (still on the branch) skips `sidewalk:*` and lanes with a check date (`cycleway:<side>:check_date:oneway`, `cycleway:<side>:check_date`).

In the tagging package the Radnetz rule `cycleway_oneway_wrong` keeps reporting `cycleway:left:oneway=yes` on a one-way road with `oneway:bicycle=no`, now as an explicit heuristic.
