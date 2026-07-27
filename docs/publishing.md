# Publishing TILDA Schemas

Two independent release tracks:

| Track | What | How |
| --- | --- | --- |
| **npm** | `@tilda-geo/bicycle-infrastructure` | Changesets, **manual** local publish (see root README **Release**) |
| **Zenodo / DOI** | Whole-repo archive of schemas + source | GitHub Release → Zenodo (this doc) |

You can publish the TS package without cutting a Zenodo release, and vice versa.

---

## npm (`@tilda-geo/bicycle-infrastructure`)

ESM-only package under `packages/bicycle-infrastructure`. Packaging and release flow match
[`osm-surface-smoothness-tagging`](https://github.com/osm-editor-kit/osm-surface-smoothness-tagging)
(manual changesets; no auto-publish CI like `maplibre-editor-layer-index`).

Prerequisites: npm org [`tilda-geo`](https://www.npmjs.com/org/tilda-geo) exists; you are
logged in with publish rights (`npm whoami`).

See root README **Release** for the step-by-step. First publish uses the current
`package.json` version after `bun run release` / `changeset publish`.

---

## Zenodo / DOI

We publish **one concept DOI for the whole repository** via Zenodo’s GitHub integration
([FixMyBerlin/private-issues#3197](https://github.com/FixMyBerlin/private-issues/issues/3197),
Variante B). Per-schema DOIs are deferred until multiple schemas are cited independently.

## Prerequisites

1. FMC Zenodo account (`dev-team@fixmycity.de`) shared in Bitwarden.
2. Enable the `FixMyBerlin/tilda-schemas` repository in Zenodo’s GitHub settings.
3. Root [`LICENSE.md`](../LICENSE.md) and [`CITATION.cff`](../CITATION.cff) present
   (**do not rename** `title` in `CITATION.cff` after the first publish).

## Cut a citable release

1. Ensure schema content that should be archived is on `main`.
2. Create a GitHub Release tagged `vX.Y.Z` (e.g. `v0.1.0`).
3. Zenodo archives the release and mints a version DOI + concept DOI.
4. Set `PUBLIC_CONCEPT_DOI` in the website CI / `.env` to the **concept** DOI
   (cite-all-versions), e.g. `10.5281/zenodo.xxxxx`.
5. Update the DOI badge on the README if desired.

**Release policy:** mint a Zenodo-worthy release when **schema content** changes
meaningfully. Skip DOI releases for website-only or package-only churn when possible.

## Website vs archived version

On the site, show:

- Concept DOI (always latest)
- Note that the online docs may be newer than the last archived release

## Later: per-schema DOIs

Schema folders under `schemas/` already have local `CHANGELOG.md` / `metadata.yaml`.
If outsiders need to cite category vs parking separately, add API-based filtered deposits
then — not required for v1.
