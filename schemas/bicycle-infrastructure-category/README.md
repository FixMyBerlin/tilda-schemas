# TILDA Bicycle Infrastructure Category

Controlled vocabulary for the **category** (`Radinfrastrukturkategorie`) of one
processed bicycle-infrastructure feature, plus language-agnostic fixtures
(`input` OSM tags → expected `category`).

This is the first published schema in [tilda-schemas](https://github.com/FixMyBerlin/tilda-schemas).
Cite the repository (see root `CITATION.cff` / Zenodo DOI) until per-schema DOIs exist.

## Contents

| Path | Role |
| --- | --- |
| [`schema/category.schema.json`](schema/category.schema.json) | JSON Schema — allowed `category` values |
| [`fixtures/`](fixtures/) | Spec cases for conformance tests |
| [`CHANGELOG.md`](CHANGELOG.md) | Schema-local history |

## Consumers

- TypeScript library: `@tilda-geo/bicycle-infrastructure` (`packages/bicycle-infrastructure`)
- LUA pipeline in [tilda-geo](https://github.com/FixMyBerlin/tilda-geo) (`processing/topics/roads_bikelanes`)
- Reconciliation tooling: `packages/bicycle-infrastructure-reconciliation`
