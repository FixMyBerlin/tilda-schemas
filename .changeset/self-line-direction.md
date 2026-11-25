---
'@tilda-geo/bicycle-infrastructure': minor
---

`_lineReversed` is now also set for the way itself (`_side: 'self'`): it is `true` on `oneway=-1` or `oneway:bicycle=-1`, as in tilda-geo `f752a49a6`. With `oneway=-1` and `oneway:bicycle=no` the line follows the motor vehicles. Together with `oneway` it gives every part's direction against its OSM line.
