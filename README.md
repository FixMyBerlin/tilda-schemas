# TILDA Schemas

Language-agnostic **schemas** and TypeScript tooling for [TILDA](https://tilda-geo.de)
bicycle-infrastructure data (roads, parking, and CQI to follow).

| Path                                                                                                | Role                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`schemas/bicycle-infrastructure-category`](schemas/bicycle-infrastructure-category/)               | Published category vocabulary + fixtures                                                                                         |
| [`schemas/bicycle-infrastructure-attributes`](schemas/bicycle-infrastructure-attributes/)           | Draft attributes (not yet published)                                                                                             |
| [`packages/bicycle-infrastructure`](packages/bicycle-infrastructure/)                               | [`@tilda-geo/bicycle-infrastructure`](https://www.npmjs.com/package/@tilda-geo/bicycle-infrastructure) — TS processor (ESM-only) |
| [`packages/bicycle-infrastructure-reconciliation`](packages/bicycle-infrastructure-reconciliation/) | LUA ↔ TS / schema cross-check (**private**, not on npm)                                                                          |

## Quick start

```bash
bun install
bun run check          # build + typecheck + library tests + export check
```

## Release (npm)

Same [changesets](https://github.com/changesets/changesets) flow as
[`osm-surface-smoothness-tagging`](https://github.com/osm-editor-kit/osm-surface-smoothness-tagging),
run **manually** (no auto-publish CI):

1. After meaningful library changes, create a changeset and commit it with your PR:
   ```bash
   bunx changeset
   ```
2. On `main`, when you want to publish:
   ```bash
   bun run version-packages   # consumes .changeset/*.md, bumps version + CHANGELOG
   git add -A && git commit -m "chore: release"
   bun run release            # build + changeset publish
   git push && git push --tags
   ```

Publishing is ESM-only. Provenance / trusted publishing (OIDC) is skipped for local
publishes; enable it when you add a CI release workflow later.

Schema DOI / Zenodo releases are separate — see [`docs/publishing.md`](docs/publishing.md).

## Docs

- [`docs/reconciliation.md`](docs/reconciliation.md) — keeping the package, schemas and the TILDA LUA pipeline aligned; gotchas
- [`docs/viewer-examples.md`](docs/viewer-examples.md) — tag cases and expected categories for the planned viewer app
- [`docs/publishing.md`](docs/publishing.md) — npm and Zenodo releases

## Citation

See [`CITATION.cff`](CITATION.cff). Publishing notes: [`docs/publishing.md`](docs/publishing.md).

<!-- After first Zenodo release, replace YOUR_CONCEPT_DOI and uncomment:
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.YOUR_CONCEPT_DOI.svg)](https://doi.org/10.5281/zenodo.YOUR_CONCEPT_DOI)
-->

## License

[AGPL-3.0-or-later](LICENSE.md) — FixMyCity / FixMyBerlin.
