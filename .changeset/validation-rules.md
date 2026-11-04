---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

Validation rules for editors, in the subpath `@tilda-geo/bicycle-infrastructure-tagging/validation` (and the root): `validateTags(tags, options)` returns findings, `RULES` is the catalogue, `MESSAGES` and `renderMessage` give the texts in German and English, `applyTagFix` applies a fix. A rule has an id, severity, source, scope, keys and a message code with parameters; a finding adds its fixes as tag changes. 21 rules wrap the todos of tilda-geo (`processBikelanes` and `deriveRoadTodos`), 5 come from the iD Radnetz Berlin editor (part widths that do not add up, are as wide as the whole way or exist on `segregated=no`, and `cycleway:*:oneway` findings) and run with `profile: 'radnetz-berlin'`. See docs/validation-rules.md.
