# `@tilda-geo/bicycle-infrastructure-reconciliation`

> **Internal package only — not published to npm.**  
> Private workspace tooling for the [tilda-schemas](https://github.com/FixMyBerlin/tilda-schemas) monorepo. Do not depend on it from apps or other repos.

There is **no** [npmx](https://npmx.dev) / npm page for this package (`"private": true`).

[Source on GitHub](https://github.com/FixMyBerlin/tilda-schemas/tree/main/packages/bicycle-infrastructure-reconciliation)

---

## What it is for

Prove that three things stay aligned:

1. **Schemas** under [`schemas/`](../../schemas/) (controlled vocabulary + fixtures)
2. **TypeScript library** [`@tilda-geo/bicycle-infrastructure`](../bicycle-infrastructure/) ([npmx](https://npmx.dev/package/@tilda-geo/bicycle-infrastructure))
3. **TILDA LUA pipeline** in [tilda-geo](https://github.com/FixMyBerlin/tilda-geo) (`processing/topics/roads_bikelanes`)

It does that with a **static Berlin reference**: Overpass raw tags + a clipped TILDA GeoJSON export. No live services required once the reference files exist.

```
schemas/  +  @tilda-geo/bicycle-infrastructure  +  TILDA LUA export
                         │
                         ▼
              this package (check / compare / validate-export)
```

---

## Commands

From this package directory (after `bun install` at the monorepo root):

```bash
bun run check              # raw OSM input ↔ LUA output → out/joined.ndjson
bun run compare            # TS library vs LUA export (field-by-field)
bun run validate-export    # LUA export vs draft attributes output schema
bun run overpass:query     # print the Overpass QL
bun run overpass:download  # one-time Overpass download (refuses to overwrite)
bun run overpass:derive-tags
bun run clip <full-export.geojson> reference/tilda-bikelanes-berlin.geojson
```

| Script            | Leg of the cross-check                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `check`           | Input↔output reconciliation; flags `constructionGap` vs real anomalies |
| `compare`         | TS ≡ LUA on the Berlin corpus                                          |
| `validate-export` | LUA values ⊆ draft `output.schema.json` vocabulary                     |

---

## Reference data

See [`reference/README.md`](reference/README.md).

Large `reference/*.json` / `*.ndjson` / `*.geojson` files are **gitignored** and regenerable. Only the Overpass query and docs are committed. Generated `out/` is also gitignored.

---

## Not for production use

- No public API, no versioning contract for external consumers
- Depends on local reference blobs and paths inside this monorepo
- If you need classification in an app, use [`@tilda-geo/bicycle-infrastructure`](../bicycle-infrastructure/) instead
