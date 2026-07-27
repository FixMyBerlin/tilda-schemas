# @tilda-geo/bicycle-infrastructure

TypeScript port of Tilda's LUA bicycle-infrastructure processing. Runs on plain OSM tag
objects (e.g. live Overpass data) so QA tools can apply the same rules to live data and
compare against Tilda during mapping campaigns.

Focus: the bicycle-infrastructure **category** (`Radinfrastrukturkategorie`) plus the
directly-relevant fields — surface, smoothness, oneway, separation (protection) left/right,
buffer, marking, traffic_mode, traffic_sign, surface_color, width.

## Usage

```ts
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'

// one OSM way's tags (e.g. an Overpass `way.tags`)
const features = processBikelanes({
  highway: 'secondary',
  'cycleway:right': 'lane',
  'cycleway:right:lane': 'exclusive',
  surface: 'asphalt',
})
// → [{ _side: 'right', _prefix: 'cycleway', category: 'cyclewayOnHighway_exclusive',
//      oneway: 'implicit_yes', surface: 'asphalt', ... }, ...]
```

One way yields 1..N features (the centerline `self` + transformed `left`/`right` sides),
matching Tilda. Disallowed sanitizer values are normalized to `null`, matching the export.

## How it maps to the LUA

Ported module-for-module from `tilda-geo/processing/topics/roads_bikelanes`:

| TS | LUA |
| --- | --- |
| `transform/prepare-tags.ts` | `helper/transform_tags/*` (lifecycle, cycleway=opposite/no) |
| `transform/transformations.ts` | `bikelanes/transformations.lua` (side splitting + unnesting) |
| `categories/decision-view.ts` | the `decision_tags_view` (DISALLOWED reads as missing) |
| `categories/bikelane-categories.ts` | `bikelanes/bikelane_categories.lua` (ordered, first-match-wins) |
| `categories/category-is-sidepath.ts` | `bikelanes/categories/category_is_sidepath.lua` |
| `sanitize/*`, `derive/*` | `helper/sanitize_*`, `derive_*`, `bikelanes/derive_*` |
| `index.ts` | `bikelanes/bikelanes.lua` |

## Tests

`bun test` runs:
- `test/spec.test.ts` — conformance against `@tilda-geo/schema` (the spec) — primary gate.
- `test/categories.smoke.test.ts` — cases ported from the LUA `__tests__`.

Validated against the real Tilda Berlin export: **100% category agreement on 43,216
features**, all sanitized fields ~100% (see `../bicycle-infrastructure-reconciliation/`).

Part of the [tilda-schemas](https://github.com/FixMyBerlin/tilda-schemas) monorepo.
Fixtures live under `schemas/`; loaded via `@tilda-geo/schema`.

## Known limitations

- `is_sidepath` for the `_adjoining`/`_isolated`/`_adjoiningOrIsolated` split uses the raw
  OSM tag (as the LUA categorization does); Tilda's `_is_sidepath` CSV estimate is an
  output column only and does not affect the category — so the category is fully
  reproducible from tags.
- `highway=construction` lifecycle is handled, but the geometry-derived crossing length
  filter (>100m) is skipped when `_length` is absent (it usually is, on live tags).
