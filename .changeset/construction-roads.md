---
'@tilda-geo/bicycle-infrastructure': minor
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

Roads and paths under construction (`highway=construction` + `construction=<class>`) count as that class, as TILDA reads them (`transform_lifecycle_tags.lua`). The core exports `highwayClass` and `isUnderConstruction` for this. In the tagging package such a road is a road again: `isRoad`, `extractOptions`, `roadAttributes`, the category planner, road widths and the path checks use the class. A way extracted from a road under construction is under construction too (`highway=construction` + `construction=cycleway|path|footway`), and so is a foot and cycle path merged from a part under construction. `withConstruction` turns a way's tags into that form.
