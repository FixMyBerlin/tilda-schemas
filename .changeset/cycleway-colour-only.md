---
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

Segregated foot and cycle path with part values (Radnetz profile): the requirement `surface_colour` only counts `cycleway:surface:colour`. A plain `surface:colour` no longer satisfies it, because only the cycleway part is of interest.
