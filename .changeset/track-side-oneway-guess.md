---
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

A track tagged on the road with no cycling infrastructure on the other side no longer shows "one direction" as its default: TILDA reads it as both ways (`assumed_no`, tilda-geo PR 424), so the oneway row is now a guess the mapper confirms. Lanes keep their default. `cycleway_oneway_redundant` still leaves the direction of a track alone.
