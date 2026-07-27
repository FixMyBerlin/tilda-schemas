# TILDA Schemas

Language-agnostic **schemas** and TypeScript tooling for [TILDA](https://tilda-geo.de)
bicycle-infrastructure data (roads, parking, and CQI to follow).

| Path | Role |
| --- | --- |
| [`schemas/bicycle-infrastructure-category`](schemas/bicycle-infrastructure-category/) | Published category vocabulary + fixtures |
| [`schemas/bicycle-infrastructure-attributes`](schemas/bicycle-infrastructure-attributes/) | Draft attributes (not yet published) |
| [`packages/bicycle-infrastructure`](packages/bicycle-infrastructure/) | `@tilda-geo/bicycle-infrastructure` — TS processor |
| [`packages/bicycle-infrastructure-reconciliation`](packages/bicycle-infrastructure-reconciliation/) | LUA ↔ TS / schema cross-check |
| [`packages/schema`](packages/schema/) | `@tilda-geo/schema` — fixture/schema loader |
| [`website`](website/) | Docs site (Astro + Keystatic) → GitHub Pages |

## Quick start

```bash
bun install
bun run check          # typecheck schema loader + library tests
bun run website:dev    # docs site with Keystatic (local)
```

## Citation

See [`CITATION.cff`](CITATION.cff). Publishing notes: [`docs/publishing.md`](docs/publishing.md).

<!-- After first Zenodo release, replace YOUR_CONCEPT_DOI and uncomment:
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.YOUR_CONCEPT_DOI.svg)](https://doi.org/10.5281/zenodo.YOUR_CONCEPT_DOI)
-->

Website: <https://fixmyberlin.github.io/tilda-schemas/> (enable Pages → GitHub Actions after first push).

## License

[AGPL-3.0-or-later](LICENSE.md) — FixMyCity / FixMyBerlin.
