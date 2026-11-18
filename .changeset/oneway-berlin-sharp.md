---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

- `cycleway_oneway_redundant` only reports lanes on the road. A track may keep `cycleway:<side>:oneway`: there it also says "not in both directions".
- `cycleway:both:oneway=yes` (or `cycleway:oneway=yes`) against the traffic of a side (`unexpected_oneway_direction`): on tracks the first fix splits it into `cycleway:left:oneway=-1` and `cycleway:right:oneway=yes`; lanes keep the fix that removes the key.
- Roads with `oneway=-1` are checked now: `yes` on a side runs against the traffic (`cycleway_oneway_wrong.reverse_road`; lanes lose the key, tracks get `-1`), `-1` on lanes repeats the default, and with `oneway:bicycle=no` the contraflow lane is on the right (`yes`), also in `cycleway_oneway_contraflow_missing`.
- A key that covers both sides is only checked for the sides without their own key.
- Extracting a side reads a misread `cycleway:both:oneway=yes` as the direction of each side (`resolveSharedOneway`): the new way gets the direction of its side and the side that stays gets its own value instead of the wrong one.
