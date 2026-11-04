---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

`gapWriteKey(gap, result)` and `gapTags(gap, result, value)` give the OSM key and the tag that answer a gap of `analyzeCategoryGaps` for one road side (`lane` → `cycleway:right:lane`, and the gap `cycleway` → `cycleway:right`, which the core's `writeKeyForSide` alone would write as `cycleway:right:cycleway`). `TILDA_LABELS.de` now also has the base categories that the gaps unlock without a suffix (`category=footAndCyclewaySegregated`, `footAndCyclewayShared`, `cycleway`, `footwayBicycleYes`), taken from the legend of tilda-geo.
