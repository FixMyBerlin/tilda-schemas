---
'@tilda-geo/bicycle-infrastructure': minor
---

- Riding direction follows tilda-geo-private#34 (not merged yet): `oneway=-1` and `oneway:bicycle=-1` are an explicit `oneway=yes` against the way, lanes and tracks on the road get `oneway=implicit_yes` when `cycleway:<side>:oneway` is missing, and `oneway:bicycle=no` with `oneway=-1` is `car_not_bike`.
- New result fields `_lineReversed` (the published line runs against the OSM way) and `offset` (sideways offset of left and right lanes in meters, signed relative to the line).
- `cycleway=opposite_lane|opposite_track` is read on `oneway=-1` roads too (mirrored) and gets an explicit `cycleway:<side>:oneway`; on a `oneway=-1` road the right side is `not_expected`; a separate way with `oneway=-1` uses `traffic_sign:backward`.
