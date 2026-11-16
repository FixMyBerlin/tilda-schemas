---
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

The road requirement `oneway` on roundabouts follows the wiki. Before, every road without `oneway` was assumed two-way ("Nicht getaggt = Straße mit Gegenverkehr"), also roundabouts.

- `junction=roundabout` implies `oneway=yes` and should not be tagged: the attribute is `inherited` from `junction=roundabout`, with no check to confirm.
- `junction=circular` requires `oneway`: the attribute is a `guess` ("TILDA nimmt yes an; bitte tagge es"), because TILDA reads it as one-way until it is tagged.
- `oneway=no` overrides both.
- `oneway:bicycle` is not asked for on either (also with `oneway=yes`): bicycles ride with the roundabout. A tagged `oneway:bicycle` still shows.
- `roadWidthFromTags` uses the one-way default width for `junction=circular` too, not only for `roundabout`.
