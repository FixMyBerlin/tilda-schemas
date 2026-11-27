---
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

- `reverseTags` keeps the second side of a key. It already turned the `oneway` values (the line is redrawn, the riding direction stays), but it also swapped every `left`/`right`, so `cycleway:both:marking:left` became `…:marking:right` and `cycleway:right:separation:left` became `cycleway:left:separation:right`. Now only the side of the road swaps (`cycleway:<side>`, `sidewalk:<side>`, `parking:<side>`); a second side is read in the lane's riding direction, as in the TILDA processing, and stays, also on a lane in both directions. On a way of its own, `separation`, `marking`, `buffer` and `traffic_mode` sides stay when the way is one-way for bicycles and swap when it is two-way. This also changes `applyTagFix` for fixes with `reverseWay`.
