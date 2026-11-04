# TILDA Bicycle Infrastructure Attributes (draft)

**Status: stub / draft — not a published schema yet.**

Will hold controlled vocabularies and fixtures for non-category output keys
(surface, smoothness, oneway, separation, buffer, marking, traffic_mode, …).

Until then:

- Fixture files under [`fixtures/`](fixtures/) keep the TypeScript library’s
  conformance suite green.
- [`schema/output.schema.json`](schema/output.schema.json) is the full draft
  vocabulary used by reconciliation (`validate-export`).

Do not cite this folder as a stable schema.

## Fixture format

Each file under `fixtures/` is a JSON array of cases:

```json
{
  "name": "what the case shows",
  "osm": "optional: source or tilda-geo commit",
  "input": { "highway": "cycleway", "traffic_sign": "DE:237" },
  "select": { "side": "self" },
  "expect": { "oneway": "assumed_no" }
}
```

- `input` are the OSM tags of one way. `_length` (a number, meters) is the length of the way, which the
  processing provides next to the tags (needed for `crossing`, `crossing_too_long`).
- `select` picks the feature: `side` (`self` | `left` | `right`, default `self`) and optional `prefix`
  (`cycleway` | `sidewalk`). `expectFeatures` is a list of `{ select, expect }` for ways with several
  features.
- `expect` compares result keys; `null` and a missing key are the same. Numbers compare with a tolerance.
- Two keys are not result keys: `todos_include` / `todos_exclude` (todo ids that have to be / must not be in
  `todos`), and `todoTagFixes` (an object compared as a whole, `null` for none).
- `road-todos/` is the exception: its cases are about the todos of a road (the way itself, `road_todo_categories.lua`),
  not about a produced feature. `input` are the tags; the optional `result` holds what the road todos read besides
  the tags (`selfBikelaneHasUnusualWidth`, `width`); `expect` has `todos` (the exact list) and/or
  `todos_include` / `todos_exclude`.
- Cases marked `follows tilda-geo-private#34 (not merged yet)` follow the tilda-geo branch
  `claude/tilda-oneway-processing-81b448` for `oneway`, `_lineReversed`, `offset` and
  `unexpected_oneway_direction`. Everything else follows tilda-geo `develop` of 2026-11-04.
