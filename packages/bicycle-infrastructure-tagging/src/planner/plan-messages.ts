import type { LabelMap } from '../labels/labels.ts'
import { fillTemplate, type MessageLanguage } from '../validations/messages.ts'
import type { PlanConflict, PlannedAdd, PlannedChange } from './category-plan.ts'

/**
 * The texts of the planner, by language and key. `{name}` is replaced by a parameter of the plan
 * entry. Same mechanism as `MESSAGES` of the validation rules.
 *
 * - Why a tag is in the plan: the key is `code` of the entry (`split_both_sides`, `side_presence`,
 *   `macro_suggestion`, `mapping_target`), for `category_requirement` the key is
 *   `category_requirement.<reasonCode>` (the stable code of the core's English reason).
 * - A conflict: the key is `conflict.<code>`.
 *
 * No source in the iD fork or tilda-geo: these texts are written for this package.
 */
export const PLAN_MESSAGES: Record<MessageLanguage, Record<string, string>> = {
  de: {
    split_both_sides: '{from} gilt für beide Seiten und wird auf die Seiten aufgeteilt.',
    side_presence: '{key} sagt, dass auf dieser Seite Radinfrastruktur liegt.',
    macro_suggestion: 'Die üblichen Tags für diese Kategorie.',
    mapping_target: 'Festes Tag des gewählten Ziels.',
    category_requirement: 'Die Kategorie braucht dieses Tag.',
    'category_requirement.required_for_category': 'Nötig für „{category}“.',
    'category_requirement.discriminator_for_category':
      'Unterscheidet „{category}“ von den ähnlichen Kategorien.',
    'category_requirement.fixed_by_mapping_target': 'Festes Tag des gewählten Ziels.',
    'category_requirement.bicycle_road': 'Die Straße ist eine Fahrradstraße.',
    'category_requirement.bicycle_road_sign': 'Das Verkehrszeichen einer Fahrradstraße (DE:244.1).',
    'category_requirement.vehicle_destination':
      'Kraftfahrzeuge nur für den Zielverkehr (Anlieger frei).',
    'category_requirement.bicycle_road_sign_vehicle_destination':
      'Das Verkehrszeichen einer Fahrradstraße mit „Anlieger frei“ (DE:244.1,1020-30).',
    'category_requirement.unsigned_cycleway': 'Ein Radweg ohne Verkehrszeichen.',
    'category_requirement.unsigned_cycleway_no_sign':
      'Ein Radweg ohne Verkehrszeichen (traffic_sign=none).',
    'category_requirement.footway_bicycles_allowed': 'Ein Gehweg, auf dem Radverkehr erlaubt ist.',
    'category_requirement.bicycle_allowed_on_footway': 'Radverkehr ist auf dem Gehweg erlaubt.',
    'category_requirement.footway_sign_bicycles_allowed':
      'Das Verkehrszeichen eines Gehwegs mit „Radfahrer frei“ (DE:239,1022-10).',
    'category_requirement.on_highway_cycle_lane': 'Ein Radstreifen auf der Fahrbahn.',
    'category_requirement.bus_lane_with_bicycles': 'Eine Busspur, auf der Radverkehr erlaubt ist.',
    'category_requirement.cycle_lane_shared_with_buses':
      'Ein Radstreifen, den auch Busse nutzen dürfen.',
    'category_requirement.protected_lane_separation':
      'Geschützter Radfahrstreifen: bauliche Trennung zur Fahrbahn.',
    'category_requirement.protected_lane_parking':
      'Geschützter Radfahrstreifen: parkende Fahrzeuge zur Fahrbahn hin.',
    'category_requirement.protected_lane_sidepath':
      'Geschützter Radfahrstreifen: verläuft an einer Straße (is_sidepath=yes).',
    'category_requirement.lifecycle':
      'Das gewählte Ziel ist „{lifecycle}“ (construction: im Bau, temporary: temporär).',
    'category_requirement.lifecycle_not_reached':
      'Ein vorhandener Lebenszyklus „{result}“ geht vor „{lifecycle}“.',
    'category_requirement.cycleway_crossing': 'Die Querung eines Radwegs.',
    'category_requirement.split_both_sides':
      '{from} gilt für beide Seiten und wird auf die Seiten aufgeteilt.',
    'category_requirement.side_presence':
      '{key} sagt, dass auf dieser Seite Radinfrastruktur liegt.',
    'category_requirement.plan_not_enough':
      'Die vorgeschlagenen Tags reichen nicht für „{target}“.',
    'category_requirement.plan_no_edits': 'Für „{target}“ lassen sich keine Tags ableiten.',
    'conflict.geometry_bicycle_road_on_sidewalk':
      'Ein Gehweg kann keine Fahrradstraße sein. Eine Fahrradstraße ist eine Straße.',
    'conflict.geometry_lane_needs_road':
      'Streifen auf der Fahrbahn gibt es nur an einer Straße, nicht an diesem Weg.',
    'conflict.geometry_bus_lane_needs_road':
      'Eine Busspur braucht eine Straße oder einen eigenen Weg (highway=cycleway).',
    'conflict.geometry_crossing_on_sidewalk':
      'Ein Gehweg (footway=sidewalk) kann keine Querung sein. Eine Querung ist ein eigener Weg.',
    'conflict.geometry_pedestrian_area_needs_pedestrian':
      'Eine Fußgängerzone mit Radverkehr braucht highway=pedestrian.',
    'conflict.geometry_path_needs_road_side':
      'Ein Weg dieser Art liegt an einer Seite der Straße oder ist ein eigener Weg. Auf der Mittellinie der Straße geht das nicht: Wähle eine Seite.',
    'conflict.geometry_lane_needs_road_side':
      'Ein Streifen liegt auf einer Seite der Straße. Auf der Mittellinie geht das nicht: Wähle eine Seite.',
    'conflict.geometry_not_a_road_side':
      'Diese Kategorie gilt für die Straße selbst oder für einen eigenen Weg, nicht für eine Straßenseite.',
    'conflict.geometry_isolated_not_a_road_side':
      'Eine Straßenseite verläuft immer an der Straße. „Selbstständig geführt“ gibt es dort nicht.',
    'conflict.geometry_needs_separate_way':
      'Zwei Linien (Radweg und Gehweg je als eigene Linie) brauchen einen eigenen Weg, keine Straßenseite.',
    'conflict.unknown_mapping_target': 'Dieses Ziel gibt es nicht.',
    'conflict.tags_not_enough': 'Mit diesen Tags ergibt sich „{result}“, nicht „{target}“.',
    'conflict.lifecycle_not_reached':
      'Diese Seite bleibt „{result}“: Ein vorhandener Lebenszyklus geht vor „{lifecycle}“.',
    'conflict.no_suggestion':
      'Für „{target}“ gibt es keinen automatischen Vorschlag, es bleibt bei „{result}“. Meist braucht die Kategorie mehr Wissen über den Weg, etwa die Fahrstreifen der Straße.',
  },
  en: {
    split_both_sides: '{from} covers both sides and is split into the sides.',
    side_presence: '{key} says there is bike infrastructure on this side.',
    macro_suggestion: 'The usual tags for this category.',
    mapping_target: 'Fixed tag of the chosen target.',
    category_requirement: 'The category needs this tag.',
    'category_requirement.required_for_category': 'Required for “{category}”.',
    'category_requirement.discriminator_for_category':
      'Tells “{category}” apart from similar categories.',
    'category_requirement.fixed_by_mapping_target': 'Fixed tag of the chosen target.',
    'category_requirement.bicycle_road': 'The road is a bicycle road.',
    'category_requirement.bicycle_road_sign': 'The traffic sign of a bicycle road (DE:244.1).',
    'category_requirement.vehicle_destination':
      'Motor vehicles only for destination traffic (Anlieger frei).',
    'category_requirement.bicycle_road_sign_vehicle_destination':
      'The traffic sign of a bicycle road with “Anlieger frei” (DE:244.1,1020-30).',
    'category_requirement.unsigned_cycleway': 'A cycleway without a traffic sign.',
    'category_requirement.unsigned_cycleway_no_sign':
      'A cycleway without a traffic sign (traffic_sign=none).',
    'category_requirement.footway_bicycles_allowed': 'A footway where bicycles are allowed.',
    'category_requirement.bicycle_allowed_on_footway': 'Bicycles are allowed on the footway.',
    'category_requirement.footway_sign_bicycles_allowed':
      'The traffic sign of a footway with bicycles allowed (DE:239,1022-10).',
    'category_requirement.on_highway_cycle_lane': 'A cycle lane on the carriageway.',
    'category_requirement.bus_lane_with_bicycles': 'A bus lane where bicycles are allowed.',
    'category_requirement.cycle_lane_shared_with_buses': 'A cycle lane that buses may use as well.',
    'category_requirement.protected_lane_separation':
      'Protected cycle lane: physical separation towards the road.',
    'category_requirement.protected_lane_parking':
      'Protected cycle lane: parked vehicles towards the road.',
    'category_requirement.protected_lane_sidepath':
      'Protected cycle lane: runs along a road (is_sidepath=yes).',
    'category_requirement.lifecycle': 'The chosen target is “{lifecycle}”.',
    'category_requirement.lifecycle_not_reached':
      'An existing lifecycle “{result}” wins over “{lifecycle}”.',
    'category_requirement.cycleway_crossing': 'The crossing of a cycleway.',
    'category_requirement.split_both_sides':
      '{from} covers both sides and is split into the sides.',
    'category_requirement.side_presence': '{key} says there is bike infrastructure on this side.',
    'category_requirement.plan_not_enough': 'The suggested tags are not enough for “{target}”.',
    'category_requirement.plan_no_edits': 'No tags can be derived for “{target}”.',
    'conflict.geometry_bicycle_road_on_sidewalk':
      'A sidewalk cannot be a bicycle road. A bicycle road is a road.',
    'conflict.geometry_lane_needs_road':
      'Lanes on the carriageway exist only on a road, not on this way.',
    'conflict.geometry_bus_lane_needs_road':
      'A bus lane needs a road or a way of its own (highway=cycleway).',
    'conflict.geometry_crossing_on_sidewalk':
      'A sidewalk (footway=sidewalk) cannot be a crossing. A crossing is a way of its own.',
    'conflict.geometry_pedestrian_area_needs_pedestrian':
      'A pedestrian zone with bicycles allowed needs highway=pedestrian.',
    'conflict.geometry_path_needs_road_side':
      'A path like this lies on one side of the road or is a way of its own. It cannot be on the centerline of the road: choose a side.',
    'conflict.geometry_lane_needs_road_side':
      'A lane lies on one side of the road. It cannot be on the centerline: choose a side.',
    'conflict.geometry_not_a_road_side':
      'This category is about the road itself or a way of its own, not a side of the road.',
    'conflict.geometry_isolated_not_a_road_side':
      'A road side always runs along the road. “Separate from the road” does not exist there.',
    'conflict.geometry_needs_separate_way':
      'Two lines (cycleway and footway each as a line of its own) need a way of their own, not a road side.',
    'conflict.unknown_mapping_target': 'This target does not exist.',
    'conflict.tags_not_enough': 'These tags give “{result}”, not “{target}”.',
    'conflict.lifecycle_not_reached':
      'This side stays “{result}”: an existing lifecycle wins over “{lifecycle}”.',
    'conflict.no_suggestion':
      'There is no automatic suggestion for “{target}”; it stays “{result}”. The category usually needs more knowledge about the way, such as the lanes of the road.',
  },
}

export interface PlanMessageOptions {
  /**
   * Category labels (`TILDA_LABELS.de`): the parameters `category`, `target` and `result` hold
   * category ids and are replaced by their label when the map has one.
   */
  categoryLabels?: LabelMap
}

const CATEGORY_PARAMS = ['category', 'target', 'result']

function withLabels(
  params: Record<string, string> | undefined,
  labels: LabelMap | undefined,
): Record<string, string> | undefined {
  if (!params || !labels) return params
  return Object.fromEntries(
    Object.entries(params).map(([name, value]) => [
      name,
      CATEGORY_PARAMS.includes(name) ? (labels[`category=${value}`] ?? value) : value,
    ]),
  )
}

/** The text of why a tag is in the plan (an entry of `add` or `change`). */
export function renderPlanReason(
  entry: Pick<PlannedAdd | PlannedChange, 'code' | 'reasonCode' | 'params'>,
  language: MessageLanguage,
  options: PlanMessageOptions = {},
): string {
  const messages = PLAN_MESSAGES[language]
  const specific =
    entry.code === 'category_requirement' && entry.reasonCode
      ? messages[`category_requirement.${entry.reasonCode}`]
      : undefined
  const template = specific ?? messages[entry.code] ?? entry.code
  return fillTemplate(template, withLabels(entry.params, options.categoryLabels))
}

/** The text of a conflict of a plan. */
export function renderPlanConflict(
  conflict: Pick<PlanConflict, 'code' | 'params'>,
  language: MessageLanguage,
  options: PlanMessageOptions = {},
): string {
  const template = PLAN_MESSAGES[language][`conflict.${conflict.code}`] ?? conflict.code
  return fillTemplate(template, withLabels(conflict.params, options.categoryLabels))
}
