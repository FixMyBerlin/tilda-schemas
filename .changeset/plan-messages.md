---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

German and English texts for the planner: `PLAN_MESSAGES` holds a text for every plan conflict code (`PLAN_CONFLICT_CODES`) and every reason code (`PLAN_REASON_CODES`, and the stable `reasonCode` of the core for `category_requirement`). `renderPlanReason(entry, lang)` and `renderPlanConflict(conflict, lang)` fill the placeholders, and name categories by their label when you pass `categoryLabels: TILDA_LABELS.de`. Plan entries now carry the core's `reasonCode`; the `tags_not_enough` and `no_suggestion` conflicts carry `params.target` and `params.result`.
