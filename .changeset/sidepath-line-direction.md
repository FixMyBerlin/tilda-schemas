---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

Line direction of cycle paths next to a road. `lineRelationToRoad` says whether the line of a way of its own runs with or against the traffic on the road side next to it, `pickSidepathRoad` picks the right road out of the roads near the way (a road that maps the side as separate before the nearest one), and the new rule `sidepath_line_against_traffic` (Radnetz profile, via `sidepathDirectionFindings` or `ValidationOptions.lineRelation`) finds `oneway=yes` / `oneway:bicycle=yes` whose line runs against the traffic; its fix reverses the way and keeps `yes`. With `RequirementOptions.lineRelation` the meaning of `yes` says "with the traffic alongside" or "against the traffic alongside". The texts of the oneway meanings speak of the line's direction ("Linienrichtung") and say to check it in the editor first.
