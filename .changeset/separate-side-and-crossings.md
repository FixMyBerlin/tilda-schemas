---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

- A road side can now be set to "Separat geführt (eigene Linie)" / "Drawn as a separate way" (`SEPARATE_KIND`, offered by `groupMappingKinds(side)` for `left` and `right`). `planForMappingChoice` plans `cycleway:<side>=separate` and removes the side's sub keys, as the extraction does. A side tagged `separate` shows it as its current state.
- Extraction: a side marked as a crossing (`cycleway:<side>:track=crossing`, `…:lane=crossing`) gives a crossing way (`cycleway=crossing`, `path=crossing`) without `is_sidepath`. The new option `asCrossing` forces one.
- `extractOptions(tags, { plainLanes: true })` also offers plain bike lanes, as a line and as a crossing. `ExtractOption` has the new fields `lane` and `crossing`.
- `extractAndMergeSides` and `isCrossingSide` are new.
- `combinedPathTags` merges a foot crossing and a bike crossing into `path=crossing` (or `path=traffic_island`).
