---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

The oneway row writes `oneway:bicycle` on a `highway=cycleway` that pedestrians use too (`foot=yes|designated` or `segregated=yes`), as on footways and paths: `oneway` there would also apply to pedestrians. A cycleway without foot traffic keeps `oneway`, as StreetComplete's cycleway direction quest does. TILDA reads both keys the same.
