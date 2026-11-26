---
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

Splitting a road side (`splitSides`, used by `planExtraction`, `separateSide` and `planLaneFromSegregatedPath`) leaves keys that name their own side further in as they are: `sidewalk:bicycle:right=separate` and `sidewalk:bicycle:both=separate` no longer become broken keys like `sidewalk:left:bicycle:right`.
