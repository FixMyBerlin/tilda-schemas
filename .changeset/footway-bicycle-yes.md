---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

A sidewalk where bicycles are only allowed ("Radfahrer frei": `highway=footway` + `bicycle=yes|permissive`, or `highway=path` + `foot=designated` + `bicycle=yes`, TILDA `footwayBicycleYes`) is now the foot line in `pathRole` (`part: 'foot'`), not one line for both modes. `partKind` finds it as the foot part for merging again, and `partWidthMode` offers no part widths on it.
