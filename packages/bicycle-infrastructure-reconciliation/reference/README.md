# Reference data (Berlin)

Static reference inputs for cross-checking the Tilda LUA pipeline and the future
TypeScript library against the shared spec. **All files cover the same Berlin bbox.**

## Bounding box

WGS84 (EPSG:4326): `W 13.0883, S 52.3383, E 13.7612, N 52.6755`
Defined once in [`../scripts/berlin-bbox.ts`](../scripts/berlin-bbox.ts) and reused by every step.

## Files

| File                             | What                                                               | CRS       | Source                                      |
| -------------------------------- | ------------------------------------------------------------------ | --------- | ------------------------------------------- |
| `tilda-bikelanes-berlin.geojson` | **LUA pipeline output** (the `bikelanes` layer), clipped to Berlin | EPSG:3857 | clipped from `bikelanes_2026-06-12.geojson` |
| `overpass-berlin-raw.json`       | **Raw OSM input** (ways + tags + geometry)                         | WGS84     | Overpass, one-time download                 |
| `overpass-berlin.overpassql`     | The exact Overpass query used                                      | —         | generated                                   |

> The two large data files are heavy (Tilda ~57 MB, Overpass ~311 MB). Decide on
> git-lfs vs. `.gitignore`+regenerate before committing — see "Regenerating" below.

## Tilda LUA export (`tilda-bikelanes-berlin.geojson`)

- Clipped from the full Berlin+Brandenburg export `bikelanes_2026-06-12.geojson`
  (103,723 features) down to **43,340 features** intersecting the Berlin bbox.
- CRS preserved as the original **EPSG:3857** (Web Mercator, meters) — a faithful copy.
- This is the **processed** output, so one OSM way can become several features:
  - `way/<id>` — the way itself (`prefix: null`)
  - `way/<id>/cycleway/left|right` — a `cycleway:left|right=*` split into a side geometry
  - `way/<id>/sidewalk/left|right` — a `sidewalk:*` split into a side geometry
  - 38,531 distinct base ways → 43,340 features.
- 49 properties per feature (`category`, `surface`, `oneway`, `separation_left/right`,
  `buffer_left/right`, `marking_left/right`, `traffic_mode_left/right`, `width`,
  `lifecycle`, `todos`, …). The side is encoded in the `id` suffix + `prefix`, not in `_side`.

## Overpass raw input (`overpass-berlin-raw.json`)

- Native Overpass JSON (`elements: [{ type: "way", id, tags, geometry }]`), **not** GeoJSON.
- Fetched **once** with geometry so the single download is maximally reusable.
- Highway filter ported from the LUA pipeline
  ([`../scripts/relevant-highways.ts`](../scripts/relevant-highways.ts), from
  `highway_classes.lua` + `exclude_highways.lua`). `bridleway` excluded (LUA always filters it).
- Includes `highway=construction` to cover ways the LUA `transform_lifecycle_tags.lua`
  resolves into real highways (`lifecycle=construction`).

### Coverage check (Tilda ↔ Overpass)

99.8% of Tilda base ways are present in the Overpass export. The original download used
a query **without** the `highway=construction` clause, so it was missing 82 ways — **all**
of them `lifecycle: construction` (81) or `blocked` (1). The query in
`overpass-berlin.overpassql` has since been corrected; re-download to reach ~100%.

## Matching strategy (for the cross-check)

Match by **OSM id**, not geometry (the two files use different CRS):

1. Group the library output and the Tilda features by `way/<id>[/prefix/side]`.
2. Compare tag-derived properties (`category`, `surface`, …) per key against the spec.
3. The library, given one raw way's tags, must emit the same set of `way/<id>[...]`
   features Tilda does (self + transformed sides).

## Regenerating

```bash
# Clip a fresh full Tilda export to Berlin (local, no network):
bun scripts/clip-tilda-export.ts <full-export.geojson> reference/tilda-bikelanes-berlin.geojson

# Print the Overpass query (paste into https://overpass-turbo.eu if needed):
bun scripts/build-overpass-query.ts

# Download from Overpass — refuses to overwrite an existing file (avoids re-downloads):
bun scripts/download-overpass.ts
```
