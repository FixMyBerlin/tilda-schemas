---
'@tilda-geo/bicycle-infrastructure': minor
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

The results of `processBikelanes` have `lifecycle` (`construction`, `construction_no_access`, `blocked`, `temporary`): the side's own, else the one of its road, as in tilda-geo. `temporary=yes` and `cycleway|sidewalk[:<side>]:temporary=yes` are read as `lifecycle=temporary` (tilda-geo `08b1428b5`), and `construction:cycleway=*` without a side counts for the cycleway, not the road (`4138bc51f`).

`planTagsForCategory` takes the option `lifecycle` (`construction` or `temporary`). The tagging package has mapping targets `<category>:construction` for every category and `<category>:temporary` for lanes, the protected lane, foot and cycle paths and footways with bicycles allowed, the helpers `lifecycleForSide` and `isPlainMappingTarget`, and the conflict `lifecycle_not_reached`.
