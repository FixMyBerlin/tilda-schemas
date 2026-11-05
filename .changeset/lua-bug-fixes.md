---
'@tilda-geo/bicycle-infrastructure': minor
---

Follows four fixes of the tilda-geo processing:

- `missing_segregated` only fires when `segregated` is neither `yes` nor `no`.
- `missing_access_tag_240` fires when `bicycle=designated` or `foot=designated` is missing, not only when both are.
- A lane between the car lanes (`cycleway:lanes=no|no|lane|no`) that is also tagged on the road side with `traffic_sign=none` is no unsigned cycleway on that side.
- The text of `unexpected_highway_path` says `highway=cycleway`.
