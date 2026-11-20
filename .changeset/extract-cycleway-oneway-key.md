---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

Extracting a cycle track that is segregated from the sidewalk (`cycleway:<side>:segregated=yes`) gives a segregated foot and cycle path (`highway=path`, `bicycle=designated`, `foot=designated`, `segregated=yes`, part keys as `cycleway:*`), the same tags as `combinedPathTags`; the editor can merge an existing sidewalk into it. The new way's direction uses the key `onewayKey` asks for: on a way with foot traffic `oneway=no` + `oneway:bicycle`, as the oneway row expects, instead of `oneway`.
