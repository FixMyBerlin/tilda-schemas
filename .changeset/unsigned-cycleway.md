---
'@tilda-geo/bicycle-infrastructure': minor
---

- `highway=cycleway` with `traffic_sign=none` is a cycleway (`cycleway_adjoiningOrIsolated`, `cycleway_adjoining`, `cycleway_isolated`) instead of `needsClarification`, like tilda-geo. `highway=cycleway` without a `traffic_sign` stays `needsClarification`.
- `analyzeCategoryGaps` names `traffic_sign=none` as a tag that settles a bare `highway=cycleway`.
