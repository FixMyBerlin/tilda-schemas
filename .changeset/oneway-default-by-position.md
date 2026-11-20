---
'@tilda-geo/bicycle-infrastructure': minor
---

- Without `oneway` / `oneway:bicycle`, the riding direction of paths follows their position, as in tilda-geo PR 424 (StVO § 2 Abs. 4): next to a road (`*_adjoining`) `implicit_yes`, away from roads (`*_isolated`) `assumed_no`; `*_adjoiningOrIsolated` keep the category default. Before, `cycleway_adjoining` was `assumed_no` and the `_isolated` foot and cycle paths and footways with `bicycle=yes` were `implicit_yes`.
- A track tagged on the road (`cycleway:<side>=track`) follows the other side of the road: `implicit_yes` when that side has cycling infrastructure (lane, track, `separate`, a sidewalk open to bicycles), else `assumed_no`.
- `CATEGORY_DEFINITIONS` and `categorizeBikelane` give the sidepath subcategories a `position` (`adjoining`, `isolated`, `adjoiningOrIsolated`) and their new `implicitOneWay`.
