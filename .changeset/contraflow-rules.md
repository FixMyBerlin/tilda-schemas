---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

Radnetz rules for one-way roads with contraflow cycling (`oneway=yes` + `oneway:bicycle=no`):

- `cycleway_oneway_wrong` asks whether `cycleway:left:oneway=yes` (or `:both:`, or without a side) is really meant, and offers `-1` for the left side as its only fix. A real `yes` is confirmed with the editor's OK, stored outside of OSM. The fixes "remove" and "set `no`" are gone: under the wiki default both kept the wrong direction or changed the meaning.
- New `cycleway_oneway_contraflow_missing`: bicycle infrastructure on the left (`lane`, `track`, `shared_lane`, `share_busway`) without any direction. Without a tag the direction of the one-way applies, but there the left lane is usually the contraflow lane. Fixes: `-1` or `no`.
