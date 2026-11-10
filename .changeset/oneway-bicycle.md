---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

`oneway:bicycle` in the editor helpers:

- `reverseTags` now flips every `oneway` value that refers to the drawing direction (`oneway:bicycle`, `cycleway:<side>:oneway`, …), not only `oneway`.
- On a way of its own, the oneway attribute is about `oneway:bicycle` when that tag is there, because TILDA reads it first. A tagged `oneway` next to it shows up in the new field `RequiredAttribute.unused`, and `attributeNote` says "… ist auch getaggt, wird aber nicht beachtet".
