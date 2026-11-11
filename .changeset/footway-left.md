---
'@tilda-geo/bicycle-infrastructure': minor
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

`footAndCyclewaySegregated` now also accepts a cycleway with the footway on its left: `traffic_mode:left=foot` with no separation on the left. Before, only `traffic_mode:right=foot` counted. Ways are drawn in the riding direction, so a one-way cycleway cannot be reversed to put the footway on its right.

In the tagging package:

- When the footway is tagged on the left, the requirements row `traffic_mode_foot` is about `traffic_mode:left`.
- `planForMappingChoice` (two lines) keeps the footway on the left and does not add `traffic_mode:right=foot`.

tilda-geo has the same change (`d1caae60d`).
