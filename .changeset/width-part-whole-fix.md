---
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

`width_part_whole` now offers two fixes: remove the part width (as before), or remove `width` and `source:width`. A path with only part widths is fine. TILDA takes its width from the part widths, and no rule complains.
