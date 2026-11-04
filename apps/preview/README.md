# Viewer (`apps/preview`)

Tags in, TILDA category, plan and findings out. It shows the same as the TILDA box of the iD Radnetz Berlin editor, without iD: every number and text comes from `@tilda-geo/bicycle-infrastructure` and `@tilda-geo/bicycle-infrastructure-tagging`. The Viewer computes nothing itself. Private, not on npm. Live: [fixmyberlin.github.io/tilda-schemas](https://fixmyberlin.github.io/tilda-schemas/).

## Run

```sh
bun install
bun run dev            # from the repo root; PORT=… to pick a port
bun run build-preview  # from the repo root; VITE_BASE=/tilda-schemas/ for GitHub Pages
```

The Vite alias and the `paths` in `tsconfig.json` point at the package source, so the packages need no build and changes reload.

## What it shows

| Part           | Package function                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Ergebnis       | `processBikelanes`, `analyzeCategoryGaps`, `categoryLabel` + `TILDA_LABELS.de`                                         |
| Ändern in      | `groupMappingTargets`, `MAPPING_TARGET_LABELS.de`, `planForMappingTarget`, `planCategoryVariants`, `applyCategoryPlan` |
| Pflichtangaben | `requiredAttributes`, `roadAttributes`, `reminders`, `tildaQaState` with the profile `radnetz-berlin`                  |
| Validierung    | `RULES`, `activeRules`, `validateTags`, `renderMessage`, `MESSAGES.de`, `applyTagFix`                                  |

## URL

The whole state is in the URL:

| Param     | What                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| `tags`    | `key=value` joined by `;`. A part without `=` belongs to the value before it (`traffic_sign=DE:240;1022-10`). |
| `side`    | `self`, `left` or `right`; default the first result                                                           |
| `target`  | id of a mapping target, e.g. `footAndCyclewayShared_adjoining:unsigned`                                       |
| `profile` | `tilda-geo` turns the profile `radnetz-berlin` (default) off                                                  |

Example: `/?tags=highway=cycleway;bicycle=designated`. The example links come from [docs/viewer-examples.md](../../docs/viewer-examples.md); keep both in sync (`src/viewer/examples.ts`).

## Tests

```sh
cd apps/preview
bun run test-e2e                                # Playwright smoke tests, starts Vite on port 5179
SCREENSHOT_DIR=/some/dir bun run test-e2e       # also saves screenshots (desktop and 375 px)
```

Not part of `bun run check` (it needs a browser: `bunx playwright install chromium`).

## Deploy

`.github/workflows/pages.yml` builds the Viewer on every push to `main` and deploys it to GitHub Pages under `/<repo>/`, with `404.html` as SPA fallback.

## UI

Tailwind CSS 4 and components of the Catalyst UI kit (`src/components/catalyst/`, copied from the Tailwind Plus workspace). German UI; category, mapping target and rule texts come from the packages.
