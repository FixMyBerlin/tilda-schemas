---
'@tilda-geo/bicycle-infrastructure': minor
'@tilda-geo/bicycle-infrastructure-tagging': patch
---

When the planner splits `cycleway:both` (or `cycleway`) into the two sides, it moves the sub-keys too (`cycleway:both:lane=advisory` → `cycleway:left:lane=advisory` and `cycleway:right:lane=advisory`), so the way keeps one scheme. A footway with bicycles allowed on a road side no longer splits the cycleway of the road. New export `categorySidePrefix(categoryId)`: the prefix of the road side object a category lives on (`sidewalk` or `cycleway`); the tagging package uses it.
