# Changelog — bicycle-infrastructure-category

## Unreleased

- `footAndCyclewaySegregated` also accepts the footway on the left of the cycleway (`traffic_mode:left=foot`,
  no separation on the left), not only on the right. Ways are drawn in the riding direction, so a one-way
  cycleway cannot be reversed to put the footway on its right. Needs the same change in tilda-geo
  (`bikelane_categories.lua`). In Berlin (OSM data of 2026-11-09) 16 ways change from `cycleway_*` to
  `footAndCyclewaySegregated_*`, all with `traffic_mode:left=foot`.

## 0.2.0 — 2026-11-04

Synced with tilda-geo `develop` of 2026-11-04. No category value is added or removed.

- `highway=cycleway` with `traffic_sign=none` (or `no`) is a cycleway (`cycleway_adjoiningOrIsolated`,
  `_adjoining` / `_isolated` with `is_sidepath`) instead of `needsClarification` (tilda-geo `98e649800`).
  `highway=cycleway` without any `traffic_sign` stays `needsClarification`; shared and segregated foot and
  cycle paths still win.
- `not_expected` on `oneway=-1` roads is the right side (mirrored from `oneway=yes`, where it is the left side),
  unless `oneway:bicycle=no`. Follows tilda-geo-private#34 (not merged yet).
- New fixtures that pin the protective `separation` set of `cyclewayOnHighwayProtected` (`bollard`, `flex_post`,
  `vertical_panel`, `studs`, `bump`, `planter`, `fence`, `jersey_barrier`, `guard_rail`, plus `separation_kerb` and
  `lane_separator` read as `bump`) and the values that do not protect (`kerb`, `yes`, `greenery`, ...). The set
  was already implemented; it is now fixed in the spec.
- Fixture change: a `cycleway:right=shared_lane` on a road is `oneway=implicit_yes` (side default), no longer
  `assumed_no`. Also from tilda-geo-private#34.

## 0.1.0 — 2026-07-27

- Initial extraction from the TILDA LUA / TypeScript bicycle-infrastructure work:
  category enum and fixtures (including explicit-absence cases).
