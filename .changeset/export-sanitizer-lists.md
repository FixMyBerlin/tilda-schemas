---
'@tilda-geo/bicycle-infrastructure': minor
---

- Export the value lists of the sanitizers (`SEPARATION_ALLOWED`, `PROTECTIVE_SEPARATION`, `MARKING_ALLOWED`, `TRAFFIC_MODE_ALLOWED`, `SURFACE_COLOR_ALLOWED`, `SURFACE_ALLOWED`, `PARKING_ALLOWED`, `DIRECTIONAL_PARKING_INFERENCE_CATEGORIES`) so editors offer the values the processing accepts.
- Export `defaultSideRunsAgainstWay(road, side)`: the riding direction of a lane without `cycleway:<side>:oneway`, as the processing derives it (follows tilda-geo-private#34, not merged yet).
