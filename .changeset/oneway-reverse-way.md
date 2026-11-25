---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

New Radnetz rule `oneway_reverse_way`: a way of its own for cycling (not a road centerline) with `oneway:bicycle=-1`, or `oneway=-1` without `oneway:bicycle`, gets a warning to reverse the way instead. Its fix has the new flag `TagFix.reverseWay`: the app reverses the way with its own function, then `change` flips the `oneway` keys from `-1` to `yes`. `applyTagFix` reverses the tags itself (`reverseTags`).
