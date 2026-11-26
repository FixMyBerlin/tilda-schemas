import { fillTemplate, type MessageLanguage } from '../validations/messages.ts'
import type { QaState } from './qa-state.ts'
import type { AttributeState, RequiredAttribute } from './types.ts'

/**
 * German and English texts for the required attributes: a label per attribute id, the notes and
 * hints of an attribute, the reminders, the QA states and the attribute states. `{name}` is a
 * placeholder.
 *
 * Source: the iD Radnetz Berlin fork (`data/core.yaml` and its German locale, `inspector.tilda.*`),
 * copied word for word. The few texts that have no source there are marked below.
 */

type Texts = Record<MessageLanguage, Record<string, string>>

/** The label of a required attribute, by `RequiredAttribute.id`. */
export const ATTRIBUTE_LABELS: Texts = {
  de: {
    width: 'Breite',
    width_effective: 'Nutzbare Breite (innerhalb der Markierung)',
    source_width: 'Quelle der Breite',
    cycleway_width: 'Breite des Radwegteils',
    source_cycleway_width: 'Quelle der Breite des Radwegteils',
    surface: 'Oberfläche',
    sett_length: 'Größe der Pflastersteine (m)',
    surface_colour: 'Farbe der Oberfläche',
    traffic_sign: 'Verkehrsschild (oder keines)',
    oneway: 'Einbahnstraße',
    oneway_bicycle: 'Einbahn für Fahrräder',
    dual_carriageway: 'Getrennte Fahrbahnen',
    is_sidepath: 'An einer Straße (Sidepath)',
    segregated: 'Fuß- und Radverkehr getrennt',
    lane: 'Art des Streifens',
    cycleway: 'Radinfrastruktur an den Seiten',
    separation_left: 'Trennung links',
    separation_right: 'Trennung rechts',
    traffic_mode_left: 'Verkehr daneben, links',
    traffic_mode_right: 'Verkehr daneben, rechts',
    traffic_mode_foot: 'Gehweg direkt daneben (eigene Linie)',
    buffer_left: 'Sicherheitstrennstreifen links',
    buffer_right: 'Sicherheitstrennstreifen rechts',
    marking_left: 'Markierung links',
    marking_right: 'Markierung rechts',
  },
  en: {
    width: 'Width',
    width_effective: 'Usable width (inside the marking)',
    source_width: 'Width source',
    cycleway_width: 'Width of the cycleway part',
    source_cycleway_width: 'Width source of the cycleway part',
    surface: 'Surface',
    sett_length: 'Sett stone size (m)',
    surface_colour: 'Surface colour',
    traffic_sign: 'Traffic sign (or none)',
    oneway: 'Oneway',
    oneway_bicycle: 'Oneway for bicycles',
    dual_carriageway: 'Dual carriageway',
    is_sidepath: 'Along a road (sidepath)',
    segregated: 'Foot and bike segregated',
    lane: 'Lane type',
    cycleway: 'Bike infrastructure on the sides',
    separation_left: 'Separation, left',
    separation_right: 'Separation, right',
    traffic_mode_left: 'Traffic next to it, left',
    traffic_mode_right: 'Traffic next to it, right',
    traffic_mode_foot: 'Footway directly next to it (its own line)',
    buffer_left: 'Buffer, left',
    buffer_right: 'Buffer, right',
    marking_left: 'Marking, left',
    marking_right: 'Marking, right',
  },
}

/**
 * What a missing tag means (`RequiredAttribute.note`, state `assumed`). `generic` is for an
 * attribute without a note, with `{tag}` = `RequiredAttribute.default`.
 */
export const ATTRIBUTE_NOTES: Texts = {
  de: {
    generic: 'Nicht getaggt = {tag}. Nur taggen, wenn es hier anders ist.',
    surface_colour:
      'Nicht getaggt = nicht eingefärbt. Nur taggen, wenn die Oberfläche rot oder grün ist.',
    oneway_bicycle:
      'Nicht getaggt = Radverkehr folgt der Einbahnstraße. Nur „no“ taggen, wenn er in Gegenrichtung fahren darf.',
    oneway_side:
      'Nicht getaggt = Radverkehr fährt mit dem Verkehr auf dieser Seite. Nur „no“ taggen, wenn er hier in beide Richtungen fahren darf.',
    oneway_road: 'Nicht getaggt = Straße mit Gegenverkehr.',
    dual_carriageway:
      'Nicht getaggt = keine getrennte Richtungsfahrbahn. „yes“ taggen, wenn die Gegenrichtung eine eigene Linie ist.',
  },
  en: {
    generic: 'Not tagged = {tag}. Tag it only if it is different here.',
    surface_colour: 'Not tagged = not coloured. Tag it only if the surface is red or green.',
    oneway_bicycle:
      'Not tagged = bicycles follow the one-way. Tag “no” only if bicycles may ride against it.',
    oneway_side:
      'Not tagged = bicycles ride with the traffic on this side. Tag “no” only if they may ride both ways here.',
    oneway_road: 'Not tagged = two-way road.',
    dual_carriageway:
      'Not tagged = no dual carriageway. Tag “yes” if the other direction is a separate way.',
  },
}

/** When an attribute applies at all (`RequiredAttribute.hint`). */
export const ATTRIBUTE_HINTS: Texts = {
  de: {
    protection:
      'Was schützt den Radfahrstreifen zur Fahrbahn hin? Eine Barriere (separation:left=bollard, flex_post, …) oder parkende Autos (traffic_mode:left=parking). Eins von beiden genügt.',
    traffic_mode_foot:
      'Nur wenn dieser getrennte Geh- und Radweg mit zwei Linien erfasst ist und dies die Radweg-Linie ist, mit dem Gehweg (eigene Linie) direkt daneben: in Zeichenrichtung rechts (traffic_mode:right=foot) oder links (traffic_mode:left=foot). Sonst nicht taggen.',
  },
  en: {
    protection:
      'What protects the lane from the carriageway? A barrier (separation:left=bollard, flex_post, …) or parked cars (traffic_mode:left=parking). One of them is enough.',
    traffic_mode_foot:
      'Only if this segregated foot and cycle path is mapped as two lines and this is the cycleway line, with the footway (its own line) directly next to it: on the right in the drawing direction (traffic_mode:right=foot) or on the left (traffic_mode:left=foot). Otherwise do not tag it.',
  },
}

export type OptionMeaningText = { label: string; hint: string }

/** What a value means where it is offered (`RequiredAttribute.optionMeanings`), by id */
export const OPTION_MEANING_TEXTS: Record<MessageLanguage, Record<string, OptionMeaningText>> = {
  de: {
    with_line: {
      label: 'nur in Linienrichtung',
      hint: 'Erst im Editor nachsehen, in welche Richtung die Linie läuft (Pfeil). Radverkehr fährt nur in Linienrichtung. Fährt er andersherum, den Weg umdrehen, nicht -1 taggen.',
    },
    with_line_with_traffic: {
      label: 'nur in Linienrichtung – mit dem Verkehr daneben',
      hint: 'Die Linie läuft in Fahrtrichtung des Verkehrs auf der Straßenseite daneben. So ist ein Einrichtungsradweg richtig gezeichnet.',
    },
    with_line_against_traffic: {
      label: 'nur in Linienrichtung – gegen den Verkehr daneben',
      hint: 'Die Linienrichtung läuft gegen den Verkehr auf der Straßenseite daneben. Fast immer ist der Weg falsch herum gezeichnet: Weg umdrehen. Nur so lassen, wenn der Radweg hier wirklich gegen den Verkehr führt (z. B. links freigegeben).',
    },
    against_line: {
      label: 'nur gegen die Linienrichtung',
      hint: 'Radverkehr fährt nur gegen die Linienrichtung. Besser den Weg umdrehen und „yes“ taggen.',
    },
    both: {
      label: 'beide Richtungen',
      hint: 'Zweirichtungsradweg: Radverkehr darf in beide Richtungen fahren. Die Linienrichtung ist dann egal.',
    },
    with_traffic: {
      label: 'mit dem Verkehr auf dieser Seite',
      hint: 'Radverkehr fährt in der Richtung des Verkehrs auf dieser Straßenseite. Das gilt auch ohne Tag.',
    },
    left_with_line: {
      label: 'links, in Linienrichtung',
      hint: 'Nur wenn die Radinfrastruktur links an der Fahrbahn liegt und trotzdem in Zeichenrichtung der Straßenlinie befahren wird, also wie der Verkehr auf der rechten Seite. Ohne Angabe gilt links -1 (gegen die Linienrichtung), das stimmt fast immer.',
    },
    contraflow: {
      label: 'gegen die Einbahnstraße',
      hint: 'Ein Radfahrstreifen in Gegenrichtung der Einbahnstraße. Ohne Angabe fährt der Radverkehr auf dieser Seite mit der Einbahnstraße.',
    },
  },
  en: {
    with_line: {
      label: 'only in the line’s direction',
      hint: 'First check in the editor which way the line runs (arrow). Bicycles ride only in the line’s direction. If they ride the other way, reverse the way, do not tag -1.',
    },
    with_line_with_traffic: {
      label: 'only in the line’s direction – with the traffic alongside',
      hint: 'The line runs with the traffic on the road side next to it. This is how a one-way cycle path is drawn.',
    },
    with_line_against_traffic: {
      label: 'only in the line’s direction – against the traffic alongside',
      hint: 'The line’s direction runs against the traffic on the road side next to it. Almost always the way is drawn the wrong way round: reverse the way. Keep it only if the path really runs against the traffic here (e.g. a signed left-side path).',
    },
    against_line: {
      label: 'only against the line’s direction',
      hint: 'Bicycles ride only against the line’s direction. Better reverse the way and tag “yes”.',
    },
    both: {
      label: 'both ways',
      hint: 'Two-way path: bicycles may ride both ways. The line’s direction does not matter then.',
    },
    with_traffic: {
      label: 'with the traffic on this side',
      hint: 'Bicycles ride in the direction of the traffic on this side of the road. This holds without a tag too.',
    },
    left_with_line: {
      label: 'left, in the line’s direction',
      hint: 'Only if the bike infrastructure is on the left of the carriageway and still ridden in the drawing direction of the road, like the traffic on the right. Without a tag the left side is -1 (against the line), which is almost always right.',
    },
    contraflow: {
      label: 'against the one-way',
      hint: 'A contraflow lane of the one-way road. Without a tag bicycles on this side ride with the one-way.',
    },
  },
}

/** The words for a value of an attribute (`RequiredAttribute.optionMeanings`), or `undefined` */
export function optionMeaningText(
  attribute: Pick<RequiredAttribute, 'optionMeanings'>,
  value: string,
  language: MessageLanguage,
): OptionMeaningText | undefined {
  const meaning = attribute.optionMeanings?.[value]
  return meaning ? OPTION_MEANING_TEXTS[language][meaning] : undefined
}

export type ReminderText = { title: string; text: string }

/** Reminders of `reminders()`, by id. */
export const REMINDER_TEXTS: Record<MessageLanguage, Record<string, ReminderText>> = {
  de: {
    damage_signs: {
      title: 'Auf Schadenschilder prüfen.',
      text: 'Steht auf diesem Weg ein Schild „Radwegschäden“, „Gehwegschäden“ oder „Geh- und Radwegschäden“ (z. B. in Mapillary oder im Infra3D-Viewer)? Dann in traffic_sign eintragen.',
    },
    barrier: {
      title: 'Auf Absperrbaken prüfen.',
      text: 'Ist der Radweg durch eine Absperrbake versperrt, sodass er nicht nutzbar ist? Dann an der Stelle einen TILDA-Hinweis anlegen (Ebene „TILDA-Hinweise“). Es ist kein OSM-Tag.',
    },
  },
  en: {
    damage_signs: {
      title: 'Check for damage signs.',
      text: 'Is there a sign “Radwegschäden”, “Gehwegschäden” or “Geh- und Radwegschäden” on this path (e.g. in Mapillary or the Infra3D viewer)? If so, add it to traffic_sign.',
    },
    barrier: {
      title: 'Check for barriers.',
      text: 'Is the cycle track blocked by a barrier (Absperrbake) so that it cannot be used? If so, add a TILDA note on the spot (TILDA Notes layer). It is not an OSM tag.',
    },
  },
}

/**
 * How complete a way is tagged (`tildaQaState`). The words come from the tooltip of the lens
 * "Radnetz QA" of the fork (green: complete; orange: tags missing; red: TILDA cannot tell the category).
 */
export const QA_STATE_LABELS: Record<MessageLanguage, Record<QaState, string>> = {
  de: { complete: 'Vollständig', incomplete: 'Tags fehlen', unclear: 'Kategorie unklar' },
  en: { complete: 'Complete', incomplete: 'Tags missing', unclear: 'Category unclear' },
}

/**
 * A short word for the state of an attribute. Written for this package: the fork has no short
 * labels, only the sentences of `ATTRIBUTE_STATE_TEXTS`.
 */
export const ATTRIBUTE_STATE_LABELS: Record<MessageLanguage, Record<AttributeState, string>> = {
  de: {
    ok: 'Getaggt',
    inherited: 'Abgeleitet',
    guess: 'Vermutet',
    assumed: 'Standard',
    ignored: 'Nicht nutzbar',
    missing: 'Fehlt',
  },
  en: {
    ok: 'Tagged',
    inherited: 'Derived',
    guess: 'Guessed',
    assumed: 'Default',
    ignored: 'Unusable',
    missing: 'Missing',
  },
}

/** What TILDA makes of a tag, and the small phrases around a missing tag. */
export const ATTRIBUTE_STATE_TEXTS: Texts = {
  de: {
    inherited: 'TILDA übernimmt {value} aus anderen Tags (z. B. der Straße)',
    derived: 'TILDA liest {value} aus {tag}',
    guess: 'TILDA nimmt {value} an; bitte tagge es',
    ignored: 'TILDA kann „{value}“ nicht verwenden: Wähle einen anderen Wert',
    normalized: 'TILDA liest es als {value}',
    unused: '{tag} ist auch getaggt, wird aber nicht beachtet',
    missing: 'fehlt',
    not_tagged: 'ist nicht getaggt',
    check_below: 'unten prüfen',
    add_below: 'unten ergänzen',
    add_below_optional: 'unten ergänzen, falls zutreffend',
    feeds: 'Genutzt für die infraVelo-Attribute: {attributes}',
  },
  en: {
    inherited: 'TILDA takes {value} from other tags (e.g. of the road)',
    derived: 'TILDA reads {value} from {tag}',
    guess: 'TILDA assumes {value}; please tag it',
    ignored: 'TILDA cannot use “{value}”: choose another value',
    normalized: 'TILDA reads it as {value}',
    unused: '{tag} is tagged too, but TILDA does not use it',
    missing: 'is missing',
    not_tagged: 'is not tagged',
    check_below: 'check below',
    add_below: 'add below',
    add_below_optional: 'add below if relevant',
    feeds: 'Used for the infraVelo attributes: {attributes}',
  },
}

/** The label of an attribute, or its id when there is no text. */
export function attributeLabel(id: string, language: MessageLanguage): string {
  return ATTRIBUTE_LABELS[language][id] ?? id
}

export function qaStateLabel(state: QaState, language: MessageLanguage): string {
  return QA_STATE_LABELS[language][state]
}

export function attributeStateLabel(state: AttributeState, language: MessageLanguage): string {
  return ATTRIBUTE_STATE_LABELS[language][state]
}

/** The text of a reminder id, or `undefined` for an id without text. */
export function reminderText(id: string, language: MessageLanguage): ReminderText | undefined {
  return REMINDER_TEXTS[language][id]
}

/** "Used for the infraVelo attributes: ...", or `undefined` when the profile feeds nothing. */
export function attributeFeedsText(
  attribute: Pick<RequiredAttribute, 'feeds'>,
  language: MessageLanguage,
): string | undefined {
  if (!attribute.feeds.length) return undefined
  return fillTemplate(ATTRIBUTE_STATE_TEXTS[language].feeds!, {
    attributes: attribute.feeds.join(', '),
  })
}

/** When the attribute applies at all (`RequiredAttribute.hint`), or `undefined`. */
export function attributeHint(
  attribute: Pick<RequiredAttribute, 'hint'>,
  language: MessageLanguage,
): string | undefined {
  return attribute.hint ? ATTRIBUTE_HINTS[language][attribute.hint] : undefined
}

/**
 * The sentence below an attribute: what TILDA makes of the tag, the meaning of a missing tag
 * (`assumed`), or when the attribute applies at all (`hint`). `undefined` when there is nothing to
 * say. Same rules as the TILDA section of the iD fork.
 */
export function attributeNote(
  attribute: Pick<
    RequiredAttribute,
    'state' | 'value' | 'tilda' | 'source' | 'note' | 'default' | 'hint' | 'unused'
  >,
  language: MessageLanguage,
): string | undefined {
  const note = valueNote(attribute, language)
  if (!attribute.unused) return note
  const unused = fillTemplate(ATTRIBUTE_STATE_TEXTS[language].unused!, { tag: attribute.unused })
  return note ? `${note}. ${unused}` : unused
}

/** What TILDA makes of the tagged value, if that is worth saying */
function valueNote(
  attribute: Pick<
    RequiredAttribute,
    'state' | 'value' | 'tilda' | 'source' | 'note' | 'default' | 'hint'
  >,
  language: MessageLanguage,
): string | undefined {
  const states = ATTRIBUTE_STATE_TEXTS[language]
  const { state, value, tilda, source } = attribute
  const text = (template: string | undefined, params: Record<string, string | undefined>) =>
    template === undefined ? undefined : fillTemplate(template, params as Record<string, string>)

  if (state === 'inherited' && source) return text(states.derived, { value: tilda, tag: source })
  if (state === 'inherited') return text(states.inherited, { value: tilda })
  if (state === 'guess') return text(states.guess, { value: tilda })
  if (state === 'assumed') {
    const notes = ATTRIBUTE_NOTES[language]
    const note = attribute.note ? notes[attribute.note] : undefined
    return text(note ?? notes.generic, { tag: attribute.default })
  }
  if (state === 'ignored') return text(states.ignored, { value })
  // when the attribute applies at all (`traffic_mode:right=foot` only for two lines)
  if (attribute.hint && state !== 'ok') return ATTRIBUTE_HINTS[language][attribute.hint]
  if (state === 'ok' && tilda !== undefined && tilda !== value) {
    // another tag decides (`oneway:bicycle` over `oneway`): name it, "reads it as yes" alone misleads
    return source
      ? text(states.derived, { value: tilda, tag: source })
      : text(states.normalized, { value: tilda })
  }
  return undefined
}
