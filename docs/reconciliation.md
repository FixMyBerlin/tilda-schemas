# LUA ↔ TypeScript reconciliation: workflow and gotchas

`@tilda-geo/bicycle-infrastructure` is a module-for-module port of the TILDA LUA pipeline in
[tilda-geo](https://github.com/FixMyBerlin/tilda-geo) (`processing/topics/roads_bikelanes/`).
The LUA code is the reference: where the package differs, LUA wins.

Three things are kept aligned:

1. the [schemas](../schemas/) (controlled vocabulary + fixtures, plain JSON, no TypeScript-isms),
2. the TypeScript package, tested against the fixtures (`bun run test-run`),
3. the LUA output, checked with [`packages/bicycle-infrastructure-reconciliation`](../packages/bicycle-infrastructure-reconciliation/)
   against a static Berlin snapshot.

Commands and the reference-file layout are described in the
[reconciliation README](../packages/bicycle-infrastructure-reconciliation/README.md) and
[`reference/README.md`](../packages/bicycle-infrastructure-reconciliation/reference/README.md); this
page covers the workflow and what is easy to get wrong.

## What the LUA pipeline does per OSM way

(`bikelanes/bikelanes.lua` in tilda-geo; local checkout is usually `~/Development/FMC/tilda-geo`.)

1. **Pre-transforms** (`roads_bikelanes.lua`): `cycleway=no` becomes `cycleway:both=no`,
   `cycleway=opposite*` is rewritten to the oneway schema, `construction:<tag>` becomes the real tag
   plus a lifecycle marker. Package: `src/transform/prepare-tags.ts`.
2. **Transformations** (`transformations.lua`): a road with `cycleway:left|right` or `sidewalk:*` is split
   into side objects (`_side = left | right | self`). `:both/:left/:right` and sub-keys are unnested
   (`cycleway:left:width` becomes `width`). Package: `src/transform/transformations.ts`.
3. **Categorization** (`bikelane_categories.lua`): ordered list, first match wins, evaluated on a
   "decision view" in which sanitizer-`disallowed` values read as missing. Package:
   `src/categories/` (`bikelane-categories.ts`, `decision-view.ts`).
4. **Sanitizers** (`helper/sanitize_road_tags.lua` and friends): normalize raw values to a controlled
   vocabulary per key. Package: `src/sanitize/`.
5. **Derivations** (`derive_surface`, `derive_smoothness`, `derive_oneway`, `derive_traffic_mode`,
   `derive_traffic_signs`; separation, buffer, marking, width, lifecycle). Package: `src/derive/`.
6. **Todos** (`bikelane_todo_categories.lua`): reasons why the tagging is not good enough, from the transformed
   tags and the result. Package: `src/derive/bikelane-todos.ts`, without the todos that need Mapillary,
   the object age or the sidepath CSV.
7. **Result tags**: the exported per-geometry properties (`category`, `oneway`, `surface`,
   `separation_left/right`, `width`, `todos`, ...). Vocabulary: `schemas/bicycle-infrastructure-attributes`.

The LUA tests (`bikelanes/__tests__/*.test.lua`) are written as tags in, expected value out. They seed
the fixtures in `schemas/`.

## Workflow when LUA changes

1. Read the tilda-geo commit (changes under `processing/topics/roads_bikelanes` and `processing/topics/helper`).
   To catch up after a while, list them all and decide per commit whether it touches the per-way tag logic:
   `git -C ~/Development/FMC/tilda-geo log --since=<last sync> --format='%h %ad %s' --date=short develop -- processing/topics/roads_bikelanes processing/topics/helper`,
   plus `processing/CHANGELOG.md`. Write the decisions down like in [lua-sync-2026-11.md](lua-sync-2026-11.md).
2. Add or adjust a **fixture** in `schemas/` first (input tags, expected category or attribute).
3. Change the package until `bun run test-run` passes. Keep the order of the category list identical to LUA:
   first match wins, and the decision view must behave the same.
4. Optionally run the Berlin cross-check (below). It only catches differences that occur in Berlin data.

## Berlin cross-check

```bash
cd packages/bicycle-infrastructure-reconciliation
bun run check             # raw OSM tags <-> LUA export, writes out/joined.ndjson
bun run compare           # package vs LUA export, field by field
bun run validate-export   # LUA values inside the attributes vocabulary
bun run explain-diffs     # differences to an older LUA export, grouped by cause
```

Status of the snapshot (LUA export of 2026-06-12, Overpass of 2026-06-13): 99.79 % of the base ways match
raw input. The package was in sync with that LUA (category agreement 100 % on 43,258 features, other fields
about 100 %). Since 2026-11-04 the package follows tilda-geo `develop` of that day (plus the oneway branch, see
[lua-sync-2026-11.md](lua-sync-2026-11.md)), so `compare` shows differences that the old export cannot know:

- category 99.60 % (172 ways: `highway=cycleway` + `traffic_sign=none` is a cycleway now), 3 features only the package
  emits (a LUA side effect of the same rule, see the sync log),
- `oneway` 92.60 % (3,200 features: lanes on the road without `cycleway:<side>:oneway` are `implicit_yes`, `oneway=-1` is explicit),
- `width` 99.99 % (`width=0` is no width).

`bun run explain-diffs` groups the differences by cause, so a new, unexplained difference stands out. Build a new
snapshot (below) when the numbers should be 100 % again.

The snapshot files are large and **gitignored** (`reference/*.json|ndjson|geojson`, `out/`). They are
not downloadable under the same date any more: a new Overpass download will not match an old LUA export.
If the files are missing on a machine, copy them from another machine rather than re-downloading; to build a
new snapshot, clip a fresh full export with `bun run clip <full-export.geojson> reference/tilda-bikelanes-berlin.geojson`
and download Overpass on the same day.

### Gotchas

1. **The TILDA export is EPSG:3857** (Web Mercator meters), Overpass is WGS84. Match by OSM id,
   never by geometry.
2. **The full export is line-delimited**: one feature per line inside `features`. Stream it
   (`scripts/clip-tilda-export.ts` does), do not `JSON.parse` 160 MB.
3. **One OSM way becomes many features.** The side is in the id suffix, not in a `_side` property:
   `way/<id>`, `way/<id>/cycleway/left|right`, `way/<id>/sidewalk/left|right`. `prefix` is exported,
   `_side` is not. Parse with `src/parse-id.ts`.
4. **Category list is ordered and order-dependent.** Port and change it in the same order as
   `bikelane_categories.lua`. Sub-categories re-invoke the base condition.
5. **Decision view.** Implemented as a JS `Proxy`: `<base>_left/right` resolve through the sided sanitizer,
   and any `disallowed` value reads as missing. LUA dropped its decision view in `df5a54bed` (performance) and
   calls the sanitizers explicitly in `footAndCyclewaySegregated` and `cyclewayOnHighwayProtected`. The result is
   the same, the package keeps the Proxy.
6. **Pre-transforms run before categorization** (see step 1 above). Without them about 40 features diverge
   (`cycleway=no` suppressing `bicycleRoad`, `cycleway=opposite*`).
7. **`is_sidepath` drives the category, not `_is_sidepath`.** `_is_sidepath` is only an output column computed
   later from the sidepath CSV. Categorization reads the raw `is_sidepath`, `_parent_highway`,
   `footway=sidewalk`, so the `_adjoining/_isolated/_adjoiningOrIsolated` split is reproducible from tags alone.
8. **`highway=construction` becomes a lifecycle.** `transform_lifecycle_tags.lua` turns
   `highway=construction` + `construction=<hw>` into a real highway with `lifecycle=construction`
   (also `blocked`). The snapshot has 82 such ways in Berlin (81 construction, 1 blocked) without raw
   input; `check` flags them as `constructionGap`, not as anomalies. The saved Overpass query has the
   clause now, the old download predates it. `proposed` and `disused` are intentionally not processed by LUA.
9. **`bridleway` is always filtered** by LUA, and left out of the highway list on purpose
   (`scripts/relevant-highways.ts`, ported from `highway_classes.lua` + `exclude_highways.lua`).
10. **Overpass answers 406 without a `User-Agent`**; `download-overpass.ts` sends one and refuses to
    overwrite an existing file.
11. **Memory.** Reading the 311 MB raw Overpass JSON needs `bun --smol` (`overpass:derive-tags`); `check`
    itself streams the NDJSON.
12. **Remaining diffs are date artifacts.** The 10 `smoothness` and 17 `smoothness_source` diffs come from the
    one-day gap between export and Overpass snapshot, not from a porting error.
