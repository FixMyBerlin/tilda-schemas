---
'@tilda-geo/bicycle-infrastructure': patch
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

Planning a crossing keeps the class of the way: a `highway=path` gets `path=crossing` (with `bicycle=designated` if cycling is not allowed yet), a `highway=footway` gets `footway=crossing` (with `bicycle=yes`). Only other ways become `highway=cycleway` + `cycleway=crossing`. Before, every crossing became a cycleway, also where people walk.
