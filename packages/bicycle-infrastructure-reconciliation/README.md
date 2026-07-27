# @tilda-geo/bicycle-infrastructure-reconciliation

Cross-check the **Tilda LUA** bicycle-infrastructure pipeline against the shared schemas
and the TypeScript library, using a static Berlin reference.

Part of [tilda-schemas](https://github.com/FixMyBerlin/tilda-schemas):

- `schemas/bicycle-infrastructure-category` — published category vocabulary + fixtures
- `@tilda-geo/bicycle-infrastructure` — TS reimplementation of the LUA logic
- **this package** — reconcile / compare / validate against a Berlin reference export

## Commands

```bash
bun run check              # reconcile raw input ↔ LUA output → out/joined.ndjson
bun run compare            # TS library vs LUA export
bun run validate-export    # LUA export vs draft output schema
bun run overpass:query     # print the Overpass query
bun run overpass:download  # one-time Overpass download (refuses to overwrite)
bun run overpass:derive-tags
bun run clip <full-export.geojson> reference/tilda-bikelanes-berlin.geojson
```

## Reference data

See [`reference/README.md`](reference/README.md). Large `*.json` / `*.ndjson` / `*.geojson`
files are gitignored and regenerable.
