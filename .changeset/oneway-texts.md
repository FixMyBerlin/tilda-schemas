---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

- On `highway=footway|path`, the oneway attribute now always writes `oneway:bicycle`. Pedestrians are never one-way, but `oneway:bicycle` says that explicitly. A plain `oneway` is still read, as TILDA does.
- `unexpected_oneway_direction` now has a message per case: `.left_with`, `.right_against`, `.both_with` and `.both_against`. Each says what the tagged value means for that side, what the default is, and when the tag is still right. Source: [Key:cycleway:right:oneway](https://wiki.openstreetmap.org/wiki/Key:cycleway:right:oneway) and its German page.
