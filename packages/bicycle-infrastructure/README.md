# `@tilda-geo/bicycle-infrastructure`

[npmx](https://npmx.dev/package/@tilda-geo/bicycle-infrastructure) · [npm](https://www.npmjs.com/package/@tilda-geo/bicycle-infrastructure) · [GitHub](https://github.com/FixMyBerlin/tilda-schemas/tree/main/packages/bicycle-infrastructure)

> **Role:** the **public TypeScript library** (ESM-only). Given plain OSM tags (e.g. from Overpass), it produces the same bicycle-infrastructure features TILDA’s LUA pipeline would — so QA tools and apps can classify live data without running osm2pgsql.

Part of the [tilda-schemas](https://github.com/FixMyBerlin/tilda-schemas) monorepo. Schemas (vocabularies + fixtures) live under [`schemas/`](../../schemas/); this package **implements** them.

```bash
npm install @tilda-geo/bicycle-infrastructure
```

---

## What it does

1. Takes one OSM way’s tags (`Record<string, string>`).
2. Applies the same transforms as TILDA LUA (lifecycle, side splitting for `cycleway:left/right` / sidewalks, sanitizers).
3. Returns **1..N features** (centerline `self` plus transformed `left`/`right` sides), each with:
   - **`category`** — `Radinfrastrukturkategorie` (primary focus; see [`schemas/bicycle-infrastructure-category`](../../schemas/bicycle-infrastructure-category/))
   - plus surface, smoothness, oneway, separation / buffer / marking, traffic_mode, traffic_sign, surface_color, width

Disallowed sanitizer values become `null`, matching TILDA’s GeoJSON export.

```ts
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'

const features = processBikelanes({
  highway: 'secondary',
  'cycleway:right': 'lane',
  'cycleway:right:lane': 'exclusive',
  surface: 'asphalt',
})
// → [{ _side: 'right', _prefix: 'cycleway', category: 'cyclewayOnHighway_exclusive',
//      oneway: 'implicit_yes', surface: 'asphalt', ... }, ...]
```

---

## How it relates to the rest of the monorepo

| Piece                                                                                           | Relationship                                                                 |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`schemas/bicycle-infrastructure-category`](../../schemas/bicycle-infrastructure-category/)     | Source of truth for allowed `category` values + fixtures                     |
| [`schemas/bicycle-infrastructure-attributes`](../../schemas/bicycle-infrastructure-attributes/) | Draft vocabularies for non-category fields (fixtures used in tests)          |
| [`bicycle-infrastructure-reconciliation`](../bicycle-infrastructure-reconciliation/)            | **Internal** tooling that proves this library ≡ TILDA LUA on a Berlin corpus |

---

## Map to TILDA LUA

Ported module-for-module from `tilda-geo` → `processing/topics/roads_bikelanes`:

| This package                    | LUA                                                             |
| ------------------------------- | --------------------------------------------------------------- |
| `transform/prepare-tags.ts`     | `helper/transform_tags/*`                                       |
| `transform/transformations.ts`  | `bikelanes/transformations.lua`                                 |
| `categories/*`                  | `bikelanes/bikelane_categories.lua` (+ decision view, sidepath) |
| `sanitize/*`, `derive/*`        | `helper/sanitize_*`, `derive_*`                                 |
| `index.ts` → `processBikelanes` | `bikelanes/bikelanes.lua`                                       |

---

## Develop / test

From the monorepo root:

```bash
bun install
bun run build
bun run --filter '@tilda-geo/bicycle-infrastructure' test
bun run check-exports
```

- `test/spec.test.ts` — conformance against `schemas/**/fixtures` (via `test/load-spec.ts`)
- `test/categories.smoke.test.ts` — cases ported from LUA `__tests__`

Berlin corpus check (category agreement ~100%): see the **internal** [reconciliation](../bicycle-infrastructure-reconciliation/) package.

Releases use [changesets](https://github.com/changesets/changesets) — see the root README **Release** section (manual publish, same as the smoothness packages).

---

## Known limitations

- `_adjoining` / `_isolated` / `_adjoiningOrIsolated` use the raw OSM `is_sidepath` tag (same as LUA categorization). TILDA’s `_is_sidepath` CSV estimate is export-only and does not affect category.
- `highway=construction` lifecycle is handled; the geometry crossing-length filter (>100 m) is skipped when `_length` is absent (typical for live Overpass tags).
