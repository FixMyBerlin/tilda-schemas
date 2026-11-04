# `@tilda-geo/bicycle-infrastructure-tagging`

[npmx](https://npmx.dev/package/@tilda-geo/bicycle-infrastructure-tagging) · [npm](https://www.npmjs.com/package/@tilda-geo/bicycle-infrastructure-tagging) · [GitHub](https://github.com/FixMyBerlin/tilda-schemas/tree/main/packages/bicycle-infrastructure-tagging)

Tagging helpers for editors of bicycle infrastructure in OpenStreetMap: plan the tag changes to reach a TILDA category, list the attributes a way still needs, read and split widths, extract a road side into a way of its own, merge cycleway and footway. Pure functions on plain OSM tags, no editor, no map.

> [!NOTE]
> Claude (Opus 5.5 and Sonnet 5.5) wrote and reviewed the TypeScript code of this package. [@tordans](https://github.com/tordans) specified what it should do. The logic comes from the iD Radnetz Berlin editor; it is not yet checked against the editors that will use it.

Part of the [tilda-schemas](https://github.com/FixMyBerlin/tilda-schemas) monorepo. It builds on [`@tilda-geo/bicycle-infrastructure`](../bicycle-infrastructure/), the TypeScript port of TILDA's LUA processing, and uses its categories, its `OsmTags` type and its parsers. The LUA processing is the reference: where this package and the LUA disagree, the LUA is right.

## Install

```bash
npm install @tilda-geo/bicycle-infrastructure-tagging
```

ESM only. `@tilda-geo/bicycle-infrastructure` is a dependency.

## What it does

| Area                                                                     | What for                                                                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `pathRole`                                                               | One definition of "path for foot and bicycle": mapped on the centerline, as one line or as two lines.                  |
| `planCategoryChange`                                                     | The tags to add, change or remove so that a way or road side gets a TILDA category.                                    |
| `MAPPING_TARGETS`, `planForMappingTarget`                                | What a mapper picks: a TILDA category plus fixed tags (signed / unsigned), grouped like tilda-geo's map legend.        |
| `requiredAttributes`, `roadAttributes`, `tildaQaState`, `reminders`      | The attributes a dataset needs per category, their state (tagged, inherited, guessed, missing), how complete a way is. |
| `profiles/radnetz-berlin`                                                | What belongs to one dataset: which tag feeds which dataset attribute, traffic signs, width sources, reminders.         |
| `roadWidthFromTags`, `partWidthMode`, ...                                | Fallback widths, which width keys exist, whether part widths add up.                                                   |
| `extractOptions`, `planExtraction`, `mergeSelection`, `combinedPathTags` | Tags for extracting a road side into a way of its own and for merging cycleway and footway.                            |
| `cyclewayOnewayFindings`                                                 | The first validation rule: `cycleway:<side>:oneway` that is wrong or repeats the default.                              |
| `TILDA_LABELS`, `categoryLabel`, `groupCategories`                       | German category names and groups as data, no localizer.                                                                |

Messages are codes with parameters (`geometry_lane_needs_road`, `cycleway_oneway_wrong`), never sentences: the app writes the text.

Riding direction follows tilda-geo-private#34 (not merged yet), as the core package does.

## Usage

### pathRole

```ts
import { pathRole } from '@tilda-geo/bicycle-infrastructure-tagging'

pathRole({ highway: 'path', bicycle: 'designated', foot: 'designated', segregated: 'yes' })
// → { style: 'oneLine', carriesFoot: true, carriesBike: true, segregated: true, part: undefined }
pathRole({ highway: 'cycleway', 'traffic_mode:right': 'foot' })
// → { style: 'twoLines', carriesFoot: false, carriesBike: true, segregated: undefined, part: 'bike' }
```

- `centerline`: the road sides (`cycleway:right=track`), widths are `cycleway:right:width`.
- `oneLine`: one way for both modes. Part widths (`cycleway:width`, `footway:width`) exist only with `segregated=yes`; with `segregated=no` there is only `width`.
- `twoLines`: a cycleway without foot access (usually `traffic_mode:right=foot`) or a footway without bicycle access. No part widths, `width` is the width of this line.

### Plan a category

```ts
import { applyCategoryPlan, planCategoryChange } from '@tilda-geo/bicycle-infrastructure-tagging'

const tags = { highway: 'residential', 'cycleway:both': 'no' }
const plan = planCategoryChange(tags, 'cyclewayOnHighway_advisory', 'right')
// plan.add:    cycleway:left=no (split_both_sides), cycleway:right=lane (side_presence), cycleway:right:lane=advisory
// plan.remove: ['cycleway:both']
applyCategoryPlan(tags, plan) // the tags after the plan
```

`planCategoryVariants` returns the ways to reach the target: the plan the planner prefers first (`variantId: 'default'`: fewest edits, no new traffic sign, `traffic_sign=none` kept), then one plan per mapping target of the category. A target that does not fit the way (a lane on a footway) is a conflict with a code. `planTagsForCategory` itself stays in `@tilda-geo/bicycle-infrastructure` (it needs the category specs, and the core cannot depend on this package).

### Mapping targets

```ts
import {
  MAPPING_TARGET_LABELS,
  applyCategoryPlan,
  groupMappingTargets,
  planForMappingTarget,
} from '@tilda-geo/bicycle-infrastructure-tagging'

for (const group of groupMappingTargets()) {
  // group.id: 'separated' | 'lane' | 'foot' | 'sidewalk' | 'mixed'
  for (const target of group.targets) console.log(MAPPING_TARGET_LABELS.de[target.labelCode])
}

const tags = { highway: 'path', traffic_sign: 'none' }
const plan = planForMappingTarget(tags, 'footAndCyclewayShared_isolated:unsigned', 'self')
// plan.add: segregated=no (mapping_target), bicycle=designated, foot=designated, is_sidepath=no
applyCategoryPlan(tags, plan)
```

A mapping target is a TILDA category (the id of tilda-geo, unchanged) plus the tags the plan must contain: `footAndCyclewayShared_adjoining:signed` (`traffic_sign=DE:240`) and `:unsigned` (`traffic_sign=none`, `segregated=no`), the same for segregated paths (`DE:241` / `segregated=yes`), cycleways and footways with bicycles allowed, and the two-line cycleway (`traffic_mode:right=foot`, a segregated path for TILDA). The list is derived from the category specs; the full table is in [docs/mapping-targets.md](../../docs/mapping-targets.md). Groups follow the legend "Führungsform einfach" of tilda-geo.

### Required attributes

```ts
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import { requiredAttributes, tildaQaState } from '@tilda-geo/bicycle-infrastructure-tagging'
import { radnetzBerlin } from '@tilda-geo/bicycle-infrastructure-tagging/profiles/radnetz-berlin'

const tags = { highway: 'secondary', 'cycleway:right': 'lane', 'cycleway:right:lane': 'exclusive' }
const result = processBikelanes(tags).find((r) => r._side === 'right')!
requiredAttributes(result, tags, { profile: radnetzBerlin })
// → [{ id: 'traffic_sign', key: 'cycleway:right:traffic_sign', state: 'missing', feeds: ['pflicht', 'fuehr', 'nutz_beschr'], ... },
//    { id: 'width', key: 'cycleway:right:width', state: 'missing', feeds: ['breite'], ... }, ...]
tildaQaState(tags, radnetzBerlin) // → { state: 'incomplete', bike: true }
```

Each attribute has a `state` (`ok`, `inherited`, `guess`, `assumed`, `ignored`, `missing`), the values to offer, and the keys TILDA reads. Option lists come from the sanitizers of the core package. A profile (`RequirementsProfile`) is a plain object: write one for another dataset.

### Widths

`roadWidthFromTags`, `widthTargetForKey`, `partWidthMode`, `partWidthMismatch`, `partWidthWholeWay`. Widths are read with `parseWidth` of the core package (m, cm, km, decimal commas). There is no second parser.

### Extract and merge

`extractOptions(tags)` lists what can be extracted from a road; `planExtraction(road, variant, side, { recommend })` returns the tags of the new way, the changes on the road and the offset. Offsets and tolerances are configuration (`DEFAULT_SIDEPATH_CONFIG`, `DEFAULT_MERGE_CONFIG`). The riding direction of the new way is the one the processing derives for that side.

### Labels

```ts
import { TILDA_LABELS, categoryLabel } from '@tilda-geo/bicycle-infrastructure-tagging'

categoryLabel('cycleway_adjoining', TILDA_LABELS.de) // → 'Radweg (straßenbegleitend)', or undefined for an unknown category
```

The labels are generated from tilda-geo's topic docs: `bun run update-labels -- <path to tilda-geo>` (or the environment variable `TILDA_GEO_PATH`; default `~/Development/FMC/tilda-geo`). tilda-geo has German labels only.

## License

[AGPL-3.0-or-later](../../LICENSE.md), FixMyCity / FixMyBerlin.
