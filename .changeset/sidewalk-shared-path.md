---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

New rule `sidewalk_shared_path` (source `radnetz`, warning). It fires on a sidewalk (`highway=footway` + `footway=sidewalk`) with `bicycle=designated` and `foot=designated` or no `foot` tag, because that is a foot and cycle path.

The fix sets `highway=path` and removes `footway=sidewalk`. It also adds `foot=designated` and `is_sidepath=yes` when they are missing. All other tags stay.

`bicycle=yes|permissive` stays a sidewalk where bicycles are allowed.
