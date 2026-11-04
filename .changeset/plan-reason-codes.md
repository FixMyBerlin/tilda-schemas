---
'@tilda-geo/bicycle-infrastructure': minor
---

Every entry of a tag plan (`add`, `change`, `conflicts` of `planTagsForCategory`) has a stable `reasonCode` (for example `required_for_category`, `bicycle_road_sign`, `plan_not_enough`) and, where the reason names something, `reasonParams` (`{ category }`, `{ target, result }`). The English `reason` stays for compatibility. `TAG_REASON_CODES`, `TagReason` and `TagReasonCode` are exported, so an app can write its own texts for the reasons.
