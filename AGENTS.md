# Agent instructions

Guidance for coding agents working in this repository.

## What lives where

- `schemas/`: language-agnostic vocabularies and fixtures. `bicycle-infrastructure-category` is the published source of truth for `category` values.
- `packages/bicycle-infrastructure`: the published TypeScript library (ESM-only). It ports the TILDA LUA bicycle-infrastructure processing (`processing/topics/roads_bikelanes` in [tilda-geo](https://github.com/FixMyBerlin/tilda-geo)). The LUA pipeline is the reference for behaviour.
- `packages/bicycle-infrastructure-tagging`: the published editor helpers (ESM-only), pure functions on OSM tags: planner wrapper, required attributes with dataset profiles, widths, extracting and merging foot and cycle paths. Depends on the core package, never the other way round. Where it differs from the iD Radnetz fork, the LUA processing wins.
- `packages/bicycle-infrastructure-reconciliation`: private tooling that checks the LUA pipeline, the TypeScript library and the schemas against each other on a static Berlin reference. Process and gotchas: [docs/reconciliation.md](docs/reconciliation.md).
- `docs/`: reconciliation, the tagging package, viewer examples and publishing (npm and Zenodo).

Run `bun run check` before you finish. It is read-only and mirrors CI.

## Releases and changesets

- Every commit that changes a package adds a changeset, see [.changeset/README.md](.changeset/README.md).
- Tobias asks for a release. Then run `bun run release` in a terminal tab, on a clean and pushed `main`. It stops for his npm 2FA, one approval covers the run.
- `bun run release --dry-run` shows what would be released and changes nothing.
- Never run `npm publish` in a package folder, and never remove packages from npm.
- `scripts/release.ts` is a copy. Change it in [osm-editor-kit/.github](https://github.com/osm-editor-kit/.github/tree/main/release) and copy it to every repository.
