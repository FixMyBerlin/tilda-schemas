---
'@tilda-geo/bicycle-infrastructure': minor
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

`planTagsForCategory` plans a road side completely, also when the side has no tags yet. Before, it wrote bare keys on the road (`cycleway=lane`, `lane=exclusive`) and even suggested `highway=cycleway`; only the tagging package's wrapper hid this.

- The plan has a new field `remove`: `cycleway:both` (or `cycleway`) when it is split into `cycleway:left` and `cycleway:right`.
- `cycleway:<side>` gets the value the category needs, a footway category sets `sidewalk:<side>`. New reason codes `split_both_sides` and `side_presence`.
- On a road side the planner never changes `highway`. Of the two objects of a side (`cycleway:right`, `sidewalk:right`) it works on the one the category lives on.
- `writeKeyForSide` without a prefix writes under `cycleway:<side>`.

Tagging package: the wrapper uses this and drops its own side handling. `splitBothSides` is removed. `categoryForSide` takes the target category as an optional third argument to read the right object of a side.
