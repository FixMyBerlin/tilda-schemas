---
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

Merged foot and cycle paths get the exact sum of the part widths, so they no longer trigger `width_part_sum`. `width_part_sum` no longer checks roads, where `width` is the carriageway. `pathRole` counts an untagged mode on a `highway=path` whose category is for both modes.
