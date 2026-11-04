---
'@tilda-geo/bicycle-infrastructure': minor
---

The planner (`planTagsForCategory`) reads the alternatives of a category from the category specs:

- Tags that settle a category are alternatives, not a conjunction: `segregated=yes` (with `bicycle` and `foot`) or `traffic_sign=DE:241` is enough, the plan never asks for both. Plans without a new traffic sign come first; a bare `highway=cycleway` → `cycleway_isolated` needs only `is_sidepath=no`.
- `traffic_sign=none` (or `no`) is never overwritten. When one alternative already holds, no sign is added.
- Fixed: target `*_adjoining` changes `is_sidepath=no` to `yes`.
- New option `fixed` (tags the plan must contain, e.g. `{ traffic_sign: 'DE:240' }`; may overwrite `traffic_sign=none`).
- New `planTagVariantsForCategory`: the plan of `planTagsForCategory` first (`default`), then `with_sign` and `without_sign` (`traffic_sign=none` plus e.g. `segregated=no`) where a sign can settle the category.
- New `categorySignOptions(categoryId)`: the signs that settle a category and whether it works without one.
- Preferred tags for more macros: unsigned cycleway, footway with bicycles allowed, cycle lane, shared bus lanes, crossings.
