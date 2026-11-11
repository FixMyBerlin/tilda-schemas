---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

Protected cycle lane: the requirements ask first what protects the lane, as `cyclewayOnHighwayProtected` reads it: a barrier (`separation:left`, protective values first, `bollard` as the first one) or parked cars (`traffic_mode:left=parking`). Both rows are always shown with the hint `protection`; each is optional once the other one protects. `traffic_mode:right` is optional, and the delimitation no longer waits for `traffic_mode` on both sides. The right separation and marking and the buffers still follow parking, but a row whose key is tagged always shows (`showWhenTagged`), so a decision like `separation:left=kerb` next to parking stays visible.
