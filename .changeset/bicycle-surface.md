---
'@tilda-geo/bicycle-infrastructure': minor
---

Bikelanes read `surface:bicycle`, `smoothness:bicycle` and the directional and side values `surface:forward|backward` and `surface:left|right`, as tilda-geo does since `7acec52af`. Fahrradstraßen, pedestrian areas and shared lanes take the bicycle surface and smoothness; cycleways and shared foot/cycle paths use `surface:bicycle` as their surface; without `surface` the worst directional or side value wins. Lanes and bus lanes without `cycleway:<side>:surface` fall back to the road's bicycle, side or direction value for their half. `surface_source` can now be `tag_directional` and `parent_highway_tag_directional`. The German `description` texts the port wrote into the tags (access road, agricultural traffic, construction, blocked) are no longer written; the package never output `description`.
