---
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

A roundabout (`junction=roundabout` or `junction=circular`) without `oneway` is a one-way road, as in tilda-geo (`normalize_oneway_tags.lua`):

- The road requirement `oneway` assumes `yes` there, with the new note `oneway_junction`. Before, it assumed `no` and said "two-way road". `oneway=no` still overrides it.
- `oneway:bicycle` is not asked for on a roundabout (also with `oneway=yes`): bicycles ride with it, so there is nothing to confirm. A tagged `oneway:bicycle` still shows.
- `roadWidthFromTags` uses the one-way default width for `junction=circular` too, not only for `roundabout`.
