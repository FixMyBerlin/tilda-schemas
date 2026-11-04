# TILDA Schemas

Language-agnostic **schemas** and TypeScript tooling for [TILDA](https://tilda-geo.de)
bicycle-infrastructure data (roads, parking, and CQI to follow).

> [!NOTE]
> Claude Opus 5.5 wrote and reviewed the TypeScript code of the packages in this repository. [@tordans](https://github.com/tordans) specified what it should do and checked it against TILDA's LUA pipeline.

Part of [TILDA](https://tilda-geo.de) by FixMyCity.

**Package:** [`@tilda-geo/bicycle-infrastructure`](https://www.npmjs.com/package/@tilda-geo/bicycle-infrastructure)
on npm (see [its README](packages/bicycle-infrastructure) for the API) · **Live preview:** [fixmyberlin.github.io/tilda-schemas](https://fixmyberlin.github.io/tilda-schemas/)

This is a Bun-workspaces monorepo:

| Path                                                                                                | Role                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`schemas/bicycle-infrastructure-category`](schemas/bicycle-infrastructure-category/)               | Published category vocabulary and fixtures.                        |
| [`schemas/bicycle-infrastructure-attributes`](schemas/bicycle-infrastructure-attributes/)           | Draft attributes (not yet published).                              |
| [`packages/bicycle-infrastructure`](packages/bicycle-infrastructure/)                               | The TypeScript processor on npm (ESM-only).                        |
| [`packages/bicycle-infrastructure-tagging`](packages/bicycle-infrastructure-tagging/)               | Editor helpers on top of it: planner, required attributes, widths. |
| [`packages/bicycle-infrastructure-reconciliation`](packages/bicycle-infrastructure-reconciliation/) | LUA, TypeScript and schema cross-check (**private**, not on npm).  |
| [`docs/reconciliation.md`](docs/reconciliation.md)                                                  | Keeping the package, schemas and the TILDA LUA pipeline aligned.   |

## Develop

```sh
bun install
bun run dev        # preview app (once apps/preview exists)
bun run test-run   # package unit tests
bun run check      # format, lint, build, type-check, tests, package exports
```

## Try it in another app before it is published

```sh
bun run build
cd packages/bicycle-infrastructure && bun pm pack --destination ../../.local
# in the app:
bun add @tilda-geo/bicycle-infrastructure@file:/absolute/path/to/.local/tilda-geo-bicycle-infrastructure-0.1.2.tgz
```

Bun caches a `file:` tarball by its path. After repacking, run `bun remove` and `bun add` again
in the app, and restart its dev server.

## Release

Versions and changelogs use [changesets](https://github.com/changesets/changesets), see [`.changeset/README.md`](.changeset/README.md). Releases run from a terminal with npm 2FA, from a clean and pushed `main`:

```bash
bun run release            # version, check, publish to npm, tag
bun run release --dry-run  # show what would be released, change nothing
```

Schema DOI and Zenodo releases are separate, see [`docs/publishing.md`](docs/publishing.md).

## Docs

- [`docs/reconciliation.md`](docs/reconciliation.md): keeping the package, schemas and the TILDA LUA pipeline aligned; gotchas
- [`docs/tagging-package.md`](docs/tagging-package.md): what the tagging package took from the iD Radnetz editor and where it differs
- [`docs/viewer-examples.md`](docs/viewer-examples.md): tag cases and expected categories for the planned viewer app
- [`docs/publishing.md`](docs/publishing.md): npm and Zenodo releases

## Citation

See [`CITATION.cff`](CITATION.cff). Publishing notes: [`docs/publishing.md`](docs/publishing.md).

<!-- After first Zenodo release, replace YOUR_CONCEPT_DOI and uncomment:
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.YOUR_CONCEPT_DOI.svg)](https://doi.org/10.5281/zenodo.YOUR_CONCEPT_DOI)
-->

## License

[AGPL-3.0-or-later](LICENSE.md), FixMyCity / FixMyBerlin.
