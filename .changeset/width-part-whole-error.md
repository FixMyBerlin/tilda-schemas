---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

`width_part_whole` is an `error` now and also applies with `segregated=no`: a part width as wide as the whole path (`highway=path` + `width=1` + `cycleway:width=1`) never makes sense. With `segregated=no` it replaces `width_part_unsegregated` for that way, so there is still one finding.
