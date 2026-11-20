---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

`mergeSelection` refuses a cycleway and a footway where only one is under construction (`different_lifecycle`): they stay two lines. `planExtraction` takes `segregatedTrack: 'twoLines'` for a segregated track whose sidewalk stays a way of its own: the new way is the cycleway line (`traffic_mode:<side>=foot` towards the sidewalk) instead of a foot and cycle path, e.g. under construction next to an open sidewalk.
