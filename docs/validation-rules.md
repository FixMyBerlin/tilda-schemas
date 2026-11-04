# Validation rules

`@tilda-geo/bicycle-infrastructure-tagging/validation` checks the tags of one way against a catalogue of rules and returns findings. It is made to plug into the validator of an editor (iD Radnetz Berlin, Maid) with a few lines each. Pure: plain tags in, findings out; no geometry, no neighbouring ways.

Two sources:

- `tilda-geo`: the todos of the TILDA processing (`todos_lines`), from `bikelane_todo_categories.lua` and `road_todo_categories.lua`. They are not re-implemented: `processBikelanes` and `deriveRoadTodos` of the core package say which todo applies, the rules add severity, keys, a message and the fix the todo proposes.
- `radnetz`: rules of the iD Radnetz Berlin editor (`modules/validations/width_parts.ts`, `cycleway_side_oneway.ts`), as far as they are pure rules on tags. They run only with the profile `radnetz-berlin`.

## Entry point

The documented entry is the subpath `@tilda-geo/bicycle-infrastructure-tagging/validation`: an adapter takes the rules and nothing of the planner or the requirement engine. The root of the package exports the same names for tools that use the whole package (the viewer).

| Export                                     | What                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `validateTags(tags, options?)`             | `Finding[]`, in the order of `RULES`. Does not change `tags`.                                                 |
| `RULES`                                    | The whole catalogue (`Rule[]`), to list all rules and mark the ones with a finding. `ruleById(id)` finds one. |
| `MESSAGES`, `renderMessage(message, lang)` | The texts, `MESSAGES.de[code]` and `MESSAGES.en[code]`, with `{placeholders}` filled from `message.params`.   |
| `applyTagFix(tags, fix)`                   | The tags after a fix.                                                                                         |
| `activeRules(options)`                     | The rules a run with these options uses.                                                                      |

### Options

| Option    | What                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `profile` | `'tilda-geo'` (default): the `tilda-geo` rules. `'radnetz-berlin'`: those and the `radnetz` rules.                                |
| `length`  | Length of the way in meters. Only `crossing_too_long` reads it (the processing's `_length`); without it that rule cannot trigger. |
| `only`    | Run only these rule ids. An adapter that registers one validator per rule uses it.                                                |
| `skip`    | Do not run these rule ids.                                                                                                        |

### Rule

```ts
type Rule = {
  id: string // stable snake_case; for todos the id of the LUA todo
  severity: 'error' | 'warning' | 'info'
  source: 'tilda-geo' | 'radnetz'
  appliesTo: ('self' | 'left' | 'right' | 'road')[]
  keys: string[] // the tags it is about, written for the way itself (see below)
  message: { code: string } // key into MESSAGES.de / MESSAGES.en; variants are `<code>.<reason>`
  check(context): RuleHit[] // used by validateTags
}
```

`scope` says which part of a way a finding is about: `self` is a way of its own for walking or cycling (`highway=path|cycleway|footway`), `left` / `right` a side of a road (`cycleway:left=*`), `road` the road itself or tags that cover both sides (`cycleway:both:oneway=yes`; the same finding on both sides is merged into one with the scope `road`).

`Rule.keys` are written for the way itself. On a road side `traffic_sign` is `cycleway:left:traffic_sign` and `{prefix}` is `cycleway:left`; `cycleway:*:oneway` stands for `left`, `right` and `both`. A finding has the keys as they are in the tags.

### Finding

```ts
type Finding = {
  ruleId: string
  severity: 'error' | 'warning' | 'info'
  source: 'tilda-geo' | 'radnetz'
  scope: 'self' | 'left' | 'right' | 'road'
  keys: string[] // as in the tags, e.g. ['cycleway:left:oneway']
  message: { code: string; params: Record<string, string | number> }
  fixes: TagFix[] // best first; can be empty
}

type TagFix = {
  message: { code: string; params: Record<string, string | number> } // the text of a button
  add?: Record<string, string>
  change?: Record<string, { from: string; to: string }>
  remove?: string[]
}
```

The spec asked for one optional fix per finding; `fixes` is a list because iD offers more than one way out for `cycleway_oneway_wrong` ("remove the tag" and "set it to `no`").

### Severities

No rule is an `error` yet; the severity is kept for contradictions that make the data unreadable. An app maps the three levels to its own: iD has `error`, `warning`, `suggestion` (= `info`); Maid has `error` and `warning`, so it shows `info` as a quiet line or leaves it out. A todo of the LUA has no severity (its priority comes from Mapillary), the ones here are ours: `warning` when the tagging is unclear, wrong or blocks a clear category, `info` when only an attribute is missing.

## Overlaps

A rule of the `radnetz` source never repeats a todo of tilda-geo (a test checks that the ids differ, and the behaviour is tested):

- `cyclewayOnewayFindings` also reports `cycleway:left:oneway=yes` on a road that is not oneway (reason `two_way_road`). That is the todo `unexpected_oneway_direction`. The rule `cycleway_oneway_wrong` reports only the contraflow case (a one-way road with `oneway:bicycle=no`), which the todo skips. The function `cyclewayOnewayFindings` still returns both reasons, for tools that use it directly.
- Part widths on a way with `segregated=no` are one finding (`width_part_unsegregated`); `width_part_sum` and `width_part_whole` stay quiet there.
- `unusual_width` exists for the way itself, the lanes and the road in the LUA. It is listed once per way: the road does not repeat it when the own line has it.

Not a rule: the required attributes (`requiredAttributes`) are an engine of their own with a state per attribute. Rules that need the geometry (`categoryGeometryMismatch`) or other ways are not pure tag rules.

## Adapters

### iD Radnetz Berlin

One iD validator per rule, so iD can switch rules off and revalidate them one by one (`modules/validations/index.ts` exports them; the fork's `cycleway_side_oneway.ts` and `width_parts.ts` are replaced by this). The check "a mapper said: this is correct here" (key-value DB) stays in the fork: it filters the findings before the issues are made.

```ts
import {
  validateTags,
  renderMessage,
  applyTagFix,
  RULES,
} from '@tilda-geo/bicycle-infrastructure-tagging/validation'
import { actionChangeTags } from '../actions/change_tags'
import { validationIssue, validationIssueFix } from '../core/validation'
import type { CreateValidator } from '../core/validation/models'

const SEVERITY = { error: 'error', warning: 'warning', info: 'suggestion' } as const
const language = () => (localizer.languageCode().startsWith('de') ? 'de' : 'en')

export const tildaValidations: Record<string, CreateValidator> = Object.fromEntries(
  RULES.map((rule) => [
    rule.id,
    () => {
      const validation = function (entity: iD.OsmEntity) {
        if (entity.type !== 'way' || !entity.tags.highway) return []
        return validateTags(entity.tags, { profile: 'radnetz-berlin', only: [rule.id] }).map(
          (finding) =>
            new validationIssue({
              type: rule.id,
              subtype: finding.message.code,
              severity: SEVERITY[finding.severity],
              hash: finding.keys.map((key) => `${key}=${entity.tags[key]}`).join('|'),
              message: () => renderMessage(finding.message, language()),
              entityIds: [entity.id],
              dynamicFixes: () =>
                finding.fixes.map(
                  (fix) =>
                    new validationIssueFix({
                      title: () => renderMessage(fix.message, language()),
                      onClick(context) {
                        const id = this.issue!.entityIds[0]
                        const tags = applyTagFix(context.entity(id).tags, fix)
                        context.perform(
                          actionChangeTags(id, tags),
                          renderMessage(fix.message, language()),
                        )
                      },
                    }),
                ),
            }),
        )
      }
      validation.type = rule.id
      return validation
    },
  ]),
)
```

If the texts should be translated by iD's localizer instead, write `MESSAGES.de` into `data/core.yaml` under `issues.tilda.<code>` and use `t.append('issues.tilda.' + code, params)` as the other validators do.

### Maid

Maid has one rule per concern (`Rule = { id, label, validate(entity, context) => Issue[] }`) and fixes as actions. The adapter makes one Maid rule per rule of the catalogue.

```ts
import { OsmWay, actionChangeTags } from '@osm-editor-kit/maid-model'
import type { Issue, Rule } from '@osm-editor-kit/maid-validation'
import {
  RULES,
  applyTagFix,
  renderMessage,
  validateTags,
} from '@tilda-geo/bicycle-infrastructure-tagging/validation'

// Maid has no `info`: show it as a warning, or filter `rule.severity === 'info'` out of RULES
const SEVERITY = { error: 'error', warning: 'warning', info: 'warning' } as const

export const tildaRules: Rule[] = RULES.map((rule) => ({
  id: rule.id,
  label: renderMessage({ code: rule.message.code, params: {} }, 'en'),
  validate(entity): Issue[] {
    if (!(entity instanceof OsmWay)) return []
    return validateTags(entity.tags, { profile: 'radnetz-berlin', only: [rule.id] }).map(
      (finding) => ({
        id: `${rule.id}:${entity.id}:${finding.keys.join(',')}`,
        rule: rule.id,
        severity: SEVERITY[finding.severity],
        message: renderMessage(finding.message, 'en'),
        entityIds: [entity.id],
        fixes: finding.fixes.map((fix, index) => ({
          id: `${rule.id}_${index}`,
          label: renderMessage(fix.message, 'en'),
          annotation: renderMessage(fix.message, 'en'),
          actions: (graph) => [
            actionChangeTags(entity.id, applyTagFix(graph.entity(entity.id).tags, fix)),
          ],
        })),
        data: { scope: finding.scope, keys: finding.keys },
      }),
    )
  },
}))
```

The `label` of a Maid rule is the sentence of the rule's base code (placeholders stay), good enough for a list of rules.

### A list of all rules (viewer)

`RULES` is the list; `validateTags(tags).map((f) => f.ruleId)` marks the ones that trigger. Everything else is greyed out.

## All rules

The table is generated: `bun run validation-rules-doc` in `packages/bicycle-infrastructure-tagging`, then `bun run format`.

<!-- rules:start -->
<!-- Generated by `bun run validation-rules-doc` in packages/bicycle-infrastructure-tagging. Do not edit. -->

26 rules.

| Source      | Rules | error | warning | info |
| ----------- | ----- | ----- | ------- | ---- |
| `tilda-geo` | 21    | 0     | 15      | 6    |
| `radnetz`   | 5     | 0     | 4       | 1    |

### Source `tilda-geo` (the todos of the processing)

| Id                                         | Severity | Applies to              | Keys                                                                              | Message (de)                                                                                                                                                        |
| ------------------------------------------ | -------- | ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crossing_too_long`                        | warning  | self                    | `highway` `cycleway` `lane` `path` `bicycle`                                      | Querung länger als 100 m, die Führungsform ist unklar. Bitte prüfen und korrigieren.                                                                                |
| `needs_clarification`                      | warning  | self, left, right       | `highway` `{prefix}` `traffic_sign` `bicycle` `foot` `segregated`                 | Die Tags reichen nicht aus, um die Radinfrastruktur einzuordnen.                                                                                                    |
| `adjoining_or_isolated`                    | warning  | self                    | `highway` `is_sidepath`                                                           | Fehlt: is_sidepath=yes oder is_sidepath=no.                                                                                                                         |
| `advisory_or_exclusive`                    | warning  | left, right             | `{prefix}` `lane`                                                                 | Fehlt: Schutzstreifen (advisory) oder Radfahrstreifen (exclusive).                                                                                                  |
| `needs_clarification_track`                | warning  | left, right             | `{prefix}` `segregated` `traffic_sign`                                            | cycleway=track reicht nicht, um die Radinfrastruktur einzuordnen. Fehlt: segregated=yes oder segregated=no, oder ein Verkehrszeichen (DE:237, DE:240, DE:241).      |
| `mixed_cycleway_both`                      | warning  | road                    | `cycleway` `cycleway:both` `cycleway:left` `cycleway:right`                       | cycleway=* oder cycleway:both=* ist mit cycleway:left / cycleway:right gemischt.                                                                                    |
| `deprecated_cycleway_shared`               | warning  | road                    | `cycleway`                                                                        | cycleway=shared ist veraltet und sollte ersetzt oder entfernt werden.                                                                                               |
| `unexpected_highway_path`                  | warning  | self                    | `highway` `bicycle` `foot`                                                        | Erwartet wird highway=cycleway (beschildert mit DE:237 oder unbeschildert) statt highway=path.                                                                      |
| `missing_traffic_sign_vehicle_destination` | info     | self                    | `bicycle_road` `vehicle` `motor_vehicle` `traffic_sign`                           | Fehlt: traffic_sign mit „Anlieger frei“ (DE:244.1,1020-30 oder ähnlich).                                                                                            |
| `missing_traffic_sign_244`                 | info     | self                    | `bicycle_road` `traffic_sign`                                                     | Fehlt: traffic_sign=DE:244.1 oder ähnlich.                                                                                                                          |
| `missing_access_tag_bicycle_road`          | warning  | self                    | `bicycle_road` `vehicle` `bicycle`                                                | Fehlt: bicycle=designated an der Fahrradstraße (wird für das Routing gebraucht).                                                                                    |
| `missing_traffic_sign`                     | info     | self, left, right       | `traffic_sign`                                                                    | Fehlt: traffic_sign=DE:* oder traffic_sign=none.                                                                                                                    |
| `malformed_traffic_sign`                   | warning  | self, left, right       | `traffic_sign` `traffic_sign:both` `traffic_sign:forward` `traffic_sign:backward` | Das Verkehrszeichen-Tag muss bereinigt werden.                                                                                                                      |
| `missing_access_tag_240`                   | warning  | self, left, right       | `traffic_sign` `bicycle` `foot`                                                   | Fehlt: bicycle=designated und foot=designated.                                                                                                                      |
| `missing_segregated`                       | warning  | self                    | `segregated` `traffic_sign` `bicycle` `foot`                                      | Fehlt: segregated=yes oder segregated=no.                                                                                                                           |
| `unexpected_bicycle_access_on_footway`     | warning  | self                    | `highway` `bicycle` `traffic_sign`                                                | Erwartet wird highway=path + bicycle=designated (DE:240) oder highway=footway + bicycle=yes (DE:239,1022-10). traffic_sign=none markiert einen unbeschilderten Weg. |
| `missing_width`                            | info     | self, left, right       | `width`                                                                           | Fehlt: width.                                                                                                                                                       |
| `unusual_width`                            | warning  | self, left, right, road | `width` `check_date:width`                                                        | width={width} ist nicht lesbar oder ungewöhnlich groß. Wert korrigieren oder mit check_date:width=* bestätigen.                                                     |
| `missing_surface`                          | info     | self, left, right       | `surface`                                                                         | Fehlt: surface.                                                                                                                                                     |
| `missing_oneway`                           | info     | self                    | `oneway`                                                                          | Fehlt: ein ausdrückliches oneway.                                                                                                                                   |
| `unexpected_oneway_direction`              | warning  | left, right, road       | `cycleway:*:oneway` `cycleway:oneway`                                             | {key}={value} lässt den Radweg gegen den Verkehr seiner Seite fahren.                                                                                               |

### Source `radnetz` (profile `radnetz-berlin`)

| Id                          | Severity | Applies to | Keys                                                                                    | Message (de)                                                                                             |
| --------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `width_part_sum`            | warning  | self, road | `width` `cycleway:width` `footway:width`                                                | width={width} ist nicht die Summe der Teilbreiten (cycleway:width + footway:width = {sum}).              |
| `width_part_whole`          | warning  | self       | `width` `cycleway:width` `footway:width`                                                | Eine Teilbreite (cycleway:width oder footway:width) ist so breit wie der ganze Weg.                      |
| `width_part_unsegregated`   | warning  | self       | `segregated` `cycleway:width` `footway:width`                                           | Teilbreiten ({keys}) an einem Weg mit segregated=no. Ohne Trennung gibt es nur width.                    |
| `cycleway_oneway_wrong`     | warning  | road       | `cycleway:left:oneway` `cycleway:right:oneway` `cycleway:both:oneway` `cycleway:oneway` | cycleway:*:oneway gilt für die Richtung des Weges, der Radweg auf dieser Seite fährt aber gegen den Weg. |
| `cycleway_oneway_redundant` | info     | road       | `cycleway:left:oneway` `cycleway:right:oneway` `cycleway:both:oneway` `cycleway:oneway` | {key}={value} ist die Richtung, in der der Radweg dieser Seite ohnehin fährt.                            |

<!-- rules:end -->
