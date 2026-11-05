import {
  BIKELANE_TODOS,
  ROAD_TODOS,
  deriveRoadTodos,
  type BikelaneResult,
} from '@tilda-geo/bicycle-infrastructure'
import type { OsmTags } from '../types.ts'
import { removeTagsFix } from './fix.ts'
import { PREFIX_KEY, effectiveSideKey, resolveKeys } from './keys.ts'
import type {
  MessageParams,
  Rule,
  RuleContext,
  RuleHit,
  RuleScope,
  RuleSeverity,
  TagFix,
} from './types.ts'

/**
 * The todos of tilda-geo as rules. Nothing is re-implemented: `processBikelanes` and `deriveRoadTodos` of
 * the core say which todo applies, the rule adds severity, keys, a message and the fix the todo proposes.
 *
 * A todo of the LUA has no severity (its priority comes from Mapillary). Ours: `warning` when the tagging
 * is unclear, wrong or blocks a clear category; `info` when only an attribute is missing.
 */

interface TodoMeta {
  severity: RuleSeverity
  appliesTo: readonly RuleScope[]
  /** Catalogue and default for the keys of a finding (see `Rule.keys`) */
  keys: readonly string[]
  /** The core derives it from the lanes and sides of the way */
  fromBikelanes: boolean
  /** The core derives it for the road (`deriveRoadTodos`) */
  fromRoad: boolean
  /** One finding for the road instead of one per side (the todo looks at the tags of the whole road) */
  roadWide?: boolean
  /** Keys of a finding of a lane or side; default: `keys` resolved for the side */
  sideKeys?: (tags: OsmTags, row: BikelaneResult) => string[]
  /** Keys of a finding of the road; default: `keys` resolved for the road */
  roadKeys?: (tags: OsmTags) => string[]
  params?: (tags: OsmTags, key: string | undefined) => MessageParams
}

const SIDE_ONEWAY_KEY = (tags: OsmTags, row: BikelaneResult): string[] => {
  if (row._side !== 'left' && row._side !== 'right') return []
  const key = effectiveSideKey(tags, row._side, row._prefix ?? 'cycleway', 'oneway')
  return key ? [key] : []
}

const MIXED_CYCLEWAY_KEYS = ['cycleway', 'cycleway:both', 'cycleway:left', 'cycleway:right']

const TODO_META: Record<string, TodoMeta> = {
  crossing_too_long: {
    severity: 'warning',
    appliesTo: ['self'],
    keys: ['highway', 'cycleway', 'lane', 'path', 'bicycle'],
    fromBikelanes: true,
    fromRoad: false,
  },
  needs_clarification: {
    severity: 'warning',
    appliesTo: ['self', 'left', 'right'],
    keys: ['highway', PREFIX_KEY, 'traffic_sign', 'bicycle', 'foot', 'segregated'],
    fromBikelanes: true,
    fromRoad: false,
  },
  adjoining_or_isolated: {
    severity: 'warning',
    appliesTo: ['self'],
    keys: ['highway', 'is_sidepath'],
    fromBikelanes: true,
    fromRoad: false,
  },
  advisory_or_exclusive: {
    severity: 'warning',
    appliesTo: ['left', 'right'],
    keys: [PREFIX_KEY, 'lane'],
    fromBikelanes: true,
    fromRoad: false,
  },
  needs_clarification_track: {
    severity: 'warning',
    appliesTo: ['left', 'right'],
    keys: [PREFIX_KEY, 'segregated', 'traffic_sign'],
    fromBikelanes: true,
    fromRoad: false,
  },
  mixed_cycleway_both: {
    severity: 'warning',
    appliesTo: ['road'],
    keys: MIXED_CYCLEWAY_KEYS,
    fromBikelanes: true,
    fromRoad: false,
    roadWide: true,
  },
  unexpected_highway_path: {
    severity: 'warning',
    appliesTo: ['self'],
    keys: ['highway', 'bicycle', 'foot'],
    fromBikelanes: true,
    fromRoad: false,
  },
  missing_traffic_sign_vehicle_destination: {
    severity: 'info',
    appliesTo: ['self'],
    keys: ['bicycle_road', 'vehicle', 'motor_vehicle', 'traffic_sign'],
    fromBikelanes: true,
    fromRoad: false,
  },
  missing_traffic_sign_244: {
    severity: 'info',
    appliesTo: ['self'],
    keys: ['bicycle_road', 'traffic_sign'],
    fromBikelanes: true,
    fromRoad: false,
  },
  missing_access_tag_bicycle_road: {
    severity: 'warning',
    appliesTo: ['self'],
    keys: ['bicycle_road', 'vehicle', 'bicycle'],
    fromBikelanes: true,
    fromRoad: false,
  },
  missing_traffic_sign: {
    severity: 'info',
    appliesTo: ['self', 'left', 'right'],
    keys: ['traffic_sign'],
    fromBikelanes: true,
    fromRoad: false,
  },
  malformed_traffic_sign: {
    severity: 'warning',
    appliesTo: ['self', 'left', 'right'],
    keys: ['traffic_sign', 'traffic_sign:both', 'traffic_sign:forward', 'traffic_sign:backward'],
    fromBikelanes: true,
    fromRoad: false,
  },
  missing_access_tag_240: {
    severity: 'warning',
    appliesTo: ['self', 'left', 'right'],
    keys: ['traffic_sign', 'bicycle', 'foot'],
    fromBikelanes: true,
    fromRoad: false,
  },
  missing_segregated: {
    severity: 'warning',
    appliesTo: ['self'],
    keys: ['segregated', 'traffic_sign', 'bicycle', 'foot'],
    fromBikelanes: true,
    fromRoad: false,
  },
  unexpected_bicycle_access_on_footway: {
    severity: 'warning',
    appliesTo: ['self'],
    keys: ['highway', 'bicycle', 'traffic_sign'],
    fromBikelanes: true,
    fromRoad: false,
  },
  missing_width: {
    severity: 'info',
    appliesTo: ['self', 'left', 'right'],
    keys: ['width'],
    fromBikelanes: true,
    fromRoad: false,
  },
  unusual_width: {
    severity: 'warning',
    appliesTo: ['self', 'left', 'right', 'road'],
    keys: ['width', 'check_date:width'],
    fromBikelanes: true,
    fromRoad: true,
    params: (tags, key) => ({ width: key ? (tags[key] ?? '') : '' }),
  },
  missing_surface: {
    severity: 'info',
    appliesTo: ['self', 'left', 'right'],
    keys: ['surface'],
    fromBikelanes: true,
    fromRoad: false,
  },
  missing_oneway: {
    severity: 'info',
    appliesTo: ['self'],
    keys: ['oneway'],
    fromBikelanes: true,
    fromRoad: false,
  },
  unexpected_oneway_direction: {
    severity: 'warning',
    appliesTo: ['left', 'right', 'road'],
    keys: ['cycleway:*:oneway', 'cycleway:oneway'],
    fromBikelanes: true,
    fromRoad: false,
    sideKeys: SIDE_ONEWAY_KEY,
    params: (tags, key) => ({ key: key ?? '', value: key ? (tags[key] ?? '') : '' }),
  },
  deprecated_cycleway_shared: {
    severity: 'warning',
    appliesTo: ['road'],
    keys: MIXED_CYCLEWAY_KEYS,
    fromBikelanes: false,
    fromRoad: true,
    roadKeys: (tags) => MIXED_CYCLEWAY_KEYS.filter((key) => tags[key] === 'shared'),
    params: (_tags, key) => ({ key: key ?? 'cycleway' }),
  },
}

/** Order: the bikelane todos as in LUA, the road todo that is no bikelane todo after the infrastructure ones */
const ROAD_ONLY_AFTER = 'mixed_cycleway_both'

function todoIds(): string[] {
  const ids = BIKELANE_TODOS.map((todo) => todo.id)
  const at = ids.indexOf(ROAD_ONLY_AFTER) + 1
  for (const todo of ROAD_TODOS) {
    if (!ids.includes(todo.id)) ids.splice(at, 0, todo.id)
  }
  return ids
}

/** Ids of the todos that have a rule (a test makes sure every todo of the core is in here) */
export const TODO_RULE_IDS = todoIds()

function fixesOf(row: BikelaneResult, id: string): TagFix[] {
  const unset = row.todoTagFixes?.[id]?.unset
  return unset?.length ? [removeTagsFix(unset)] : []
}

function hitsOfBikelanes(id: string, meta: TodoMeta, context: RuleContext): RuleHit[] {
  const { tags } = context
  const rows = context.bikelanes().filter((row) => row.todos?.includes(id))
  if (!rows.length) return []

  if (meta.roadWide) {
    const keys = meta.keys.filter((key) => tags[key] !== undefined)
    return [{ scope: 'road', keys: keys.length ? keys : [...meta.keys], message: { params: {} } }]
  }

  const hits = rows.map((row): RuleHit => {
    const scope: RuleScope = row._side
    const keys =
      meta.sideKeys?.(tags, row) ??
      resolveKeys(
        tags,
        scope,
        row._prefix,
        meta.keys.filter((key) => key !== 'check_date:width'),
      )
    return {
      scope,
      keys,
      message: { params: meta.params?.(tags, keys[0]) ?? {} },
      fixes: fixesOf(row, id),
    }
  })
  return mergeSides(hits)
}

/**
 * The same finding on the left and the right side is one finding for the road: the tags that cause it cover
 * both sides (`cycleway:both:oneway=yes`).
 */
function mergeSides(hits: RuleHit[]): RuleHit[] {
  const signature = (hit: RuleHit) =>
    JSON.stringify([hit.keys, hit.message?.params, hit.fixes ?? []])
  const left = hits.find((hit) => hit.scope === 'left')
  const right = hits.find((hit) => hit.scope === 'right')
  if (!left || !right || signature(left) !== signature(right)) return hits
  return [
    { ...left, scope: 'road' },
    ...hits.filter((hit) => hit.scope !== 'left' && hit.scope !== 'right'),
  ]
}

function hitsOfRoad(id: string, meta: TodoMeta, context: RuleContext): RuleHit[] {
  const { tags } = context
  const selfRow = context.bikelanes().find((row) => row._side === 'self')
  const todos = deriveRoadTodos(tags, {
    selfBikelaneHasUnusualWidth: selfRow?.todos?.includes('unusual_width') ?? false,
  })
  if (!todos.includes(id)) return []
  const keys =
    meta.roadKeys?.(tags) ??
    resolveKeys(
      tags,
      'road',
      null,
      meta.keys.filter((key) => key !== 'check_date:width'),
    )
  return [{ scope: 'road', keys, message: { params: meta.params?.(tags, keys[0]) ?? {} } }]
}

function todoRule(id: string): Rule {
  const meta = TODO_META[id]
  if (!meta) throw new Error(`No rule data for the todo ${id}`)
  return {
    id,
    severity: meta.severity,
    source: 'tilda-geo',
    appliesTo: meta.appliesTo,
    keys: meta.keys,
    message: { code: id },
    check(context) {
      return [
        ...(meta.fromBikelanes ? hitsOfBikelanes(id, meta, context) : []),
        ...(meta.fromRoad ? hitsOfRoad(id, meta, context) : []),
      ]
    },
  }
}

export const TILDA_GEO_RULES: readonly Rule[] = TODO_RULE_IDS.map(todoRule)
