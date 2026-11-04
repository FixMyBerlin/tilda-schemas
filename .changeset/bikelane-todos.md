---
'@tilda-geo/bicycle-infrastructure': minor
---

- New result field `todos` (ids of the tagging problems of a feature, like `_todo_list` in tilda-geo) and `todoTagFixes`, plus the exports `BIKELANE_TODOS`, `deriveBikelaneTodos` and `isUnusualWidth`. Ported from `bikelane_todo_categories.lua`, without the todos that need Mapillary, the object age or the sidepath CSV.
- `needs_clarification_track` is checked per road side: a sign (DE:237, DE:240, DE:241) or `segregated` on one side closes only that side (tilda-geo `48b04faf5`).
- New todo `unusual_width` (width we cannot read, `0`, negative or above 50 m, closed by a check date) and `unexpected_oneway_direction` (`cycleway:left:oneway=yes`, `cycleway:right:oneway=-1` on a road that is not oneway; follows tilda-geo-private#34, not merged yet). `missing_oneway` is no longer set for lanes and tracks on the road.
