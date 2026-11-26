---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

New: extract the bike lane from a segregated foot and cycle path that is really a sidewalk next to a bike lane on the carriageway. `canPlanLaneFromSegregatedPath(tags)` says when it fits; `planLaneFromSegregatedPath(path, road, { roadSide, pathAlongRoad, target: 'line' | 'centerline', lane })` gives the tags of the sidewalk, of the lane (as a line of its own or on the road) and of the road, plus `review` messages for what is not guessed (traffic sign, width of the whole path, `bicycle=use_sidepath`). `wayPlacement(way, road)` gives the side and drawing direction of a way next to a road.

Fix: a plain bike lane extracted from the road as a line (`planExtraction`) keeps `cycleway=lane` and its `lane=*`, so TILDA reads it as a lane, not as a cycle track.
