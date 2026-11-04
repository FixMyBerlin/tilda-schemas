import type { MessageRef } from './types.ts'

export type MessageLanguage = 'de' | 'en'

/**
 * The texts of all findings and fixes, by language and code. A `{name}` is replaced by the value of the
 * parameter of the message (`renderMessage`). The apps own their typography; these are plain sentences.
 */
export const MESSAGES: Record<MessageLanguage, Record<string, string>> = {
  de: {
    // tilda-geo: bikelane todos
    crossing_too_long:
      'Querung länger als 100 m, die Führungsform ist unklar. Bitte prüfen und korrigieren.',
    needs_clarification: 'Die Tags reichen nicht aus, um die Radinfrastruktur einzuordnen.',
    adjoining_or_isolated: 'Fehlt: is_sidepath=yes oder is_sidepath=no.',
    advisory_or_exclusive: 'Fehlt: Schutzstreifen (advisory) oder Radfahrstreifen (exclusive).',
    needs_clarification_track:
      'cycleway=track reicht nicht, um die Radinfrastruktur einzuordnen. Fehlt: segregated=yes oder segregated=no, oder ein Verkehrszeichen (DE:237, DE:240, DE:241).',
    mixed_cycleway_both:
      'cycleway=* oder cycleway:both=* ist mit cycleway:left / cycleway:right gemischt.',
    unexpected_highway_path:
      'Erwartet wird highway=cycleway (beschildert mit DE:237 oder unbeschildert) statt highway=path.',
    missing_traffic_sign_vehicle_destination:
      'Fehlt: traffic_sign mit „Anlieger frei“ (DE:244.1,1020-30 oder ähnlich).',
    missing_traffic_sign_244: 'Fehlt: traffic_sign=DE:244.1 oder ähnlich.',
    missing_access_tag_bicycle_road:
      'Fehlt: bicycle=designated an der Fahrradstraße (wird für das Routing gebraucht).',
    missing_traffic_sign: 'Fehlt: traffic_sign=DE:* oder traffic_sign=none.',
    malformed_traffic_sign: 'Das Verkehrszeichen-Tag muss bereinigt werden.',
    missing_access_tag_240: 'Fehlt: bicycle=designated und foot=designated.',
    missing_segregated: 'Fehlt: segregated=yes oder segregated=no.',
    unexpected_bicycle_access_on_footway:
      'Erwartet wird highway=path + bicycle=designated (DE:240) oder highway=footway + bicycle=yes (DE:239,1022-10). traffic_sign=none markiert einen unbeschilderten Weg.',
    missing_width: 'Fehlt: width.',
    unusual_width:
      'width={width} ist nicht lesbar oder ungewöhnlich groß. Wert korrigieren oder mit check_date:width=* bestätigen.',
    missing_surface: 'Fehlt: surface.',
    missing_oneway: 'Fehlt: ein ausdrückliches oneway.',
    unexpected_oneway_direction:
      '{key}={value} lässt den Radweg gegen den Verkehr seiner Seite fahren.',
    deprecated_cycleway_shared:
      'cycleway=shared ist veraltet und sollte ersetzt oder entfernt werden.',
    // radnetz: widths
    width_part_sum:
      'width={width} ist nicht die Summe der Teilbreiten (cycleway:width + footway:width = {sum}).',
    width_part_whole:
      'Eine Teilbreite (cycleway:width oder footway:width) ist so breit wie der ganze Weg.',
    'width_part_whole.cycleway':
      'cycleway:width={meters} ist so breit wie der ganze Weg (width={width}). Für den Fußweg bleibt nichts.',
    'width_part_whole.footway':
      'footway:width={meters} ist so breit wie der ganze Weg (width={width}). Für den Radweg bleibt nichts.',
    width_part_unsegregated:
      'Teilbreiten ({keys}) an einem Weg mit segregated=no. Ohne Trennung gibt es nur width.',
    // radnetz: oneway
    cycleway_oneway_wrong:
      'cycleway:*:oneway gilt für die Richtung des Weges, der Radweg auf dieser Seite fährt aber gegen den Weg.',
    'cycleway_oneway_wrong.contraflow':
      '{key}={value} gilt für die Richtung des Weges, der Radweg auf dieser Seite fährt aber gegen den Weg.',
    cycleway_oneway_redundant:
      '{key}={value} ist die Richtung, in der der Radweg dieser Seite ohnehin fährt.',
    // fixes
    'fix.remove_tags': '{keys} entfernen',
    'fix.set_tag': '{key}={value} setzen',
    'fix.width_part_sum': 'width={sum} setzen',
  },
  en: {
    crossing_too_long:
      'Crossing longer than 100 m, guidance form unclear. Please review and correct.',
    needs_clarification: 'The tags are not enough to categorize the bike infrastructure.',
    adjoining_or_isolated: 'Missing: is_sidepath=yes or is_sidepath=no.',
    advisory_or_exclusive: 'Missing: advisory lane or exclusive lane (cycleway:*:lane).',
    needs_clarification_track:
      'cycleway=track is not enough to categorize the bike infrastructure. Missing: segregated=yes or segregated=no, or a traffic sign (DE:237, DE:240, DE:241).',
    mixed_cycleway_both:
      'cycleway=* or cycleway:both=* is mixed with cycleway:left / cycleway:right.',
    unexpected_highway_path:
      'Expected highway=cycleway (signed DE:237 or unsigned) instead of highway=path.',
    missing_traffic_sign_vehicle_destination:
      'Missing: traffic_sign for "Anlieger frei" (DE:244.1,1020-30 or similar).',
    missing_traffic_sign_244: 'Missing: traffic_sign=DE:244.1 or similar.',
    missing_access_tag_bicycle_road:
      'Missing: bicycle=designated on the bicycle road (routing needs it).',
    missing_traffic_sign: 'Missing: traffic_sign=DE:* or traffic_sign=none.',
    malformed_traffic_sign: 'The traffic sign tag needs cleaning up.',
    missing_access_tag_240: 'Missing: bicycle=designated and foot=designated.',
    missing_segregated: 'Missing: segregated=yes or segregated=no.',
    unexpected_bicycle_access_on_footway:
      'Expected highway=path + bicycle=designated (DE:240) or highway=footway + bicycle=yes (DE:239,1022-10). traffic_sign=none marks an unsigned path.',
    missing_width: 'Missing: width.',
    unusual_width:
      'width={width} cannot be read or is unusually high. Fix the value or confirm it with check_date:width=*.',
    missing_surface: 'Missing: surface.',
    missing_oneway: 'Missing: an explicit oneway.',
    unexpected_oneway_direction:
      '{key}={value} makes the cycle path run against the traffic of its side.',
    deprecated_cycleway_shared: 'cycleway=shared is deprecated and should be replaced or removed.',
    width_part_sum:
      'width={width} is not the sum of the part widths (cycleway:width + footway:width = {sum}).',
    width_part_whole:
      'A part width (cycleway:width or footway:width) is as wide as the whole path.',
    'width_part_whole.cycleway':
      'cycleway:width={meters} is as wide as the whole path (width={width}). Nothing is left for the footway.',
    'width_part_whole.footway':
      'footway:width={meters} is as wide as the whole path (width={width}). Nothing is left for the cycleway.',
    width_part_unsegregated:
      'Part widths ({keys}) on a way with segregated=no. Without a separation there is only width.',
    cycleway_oneway_wrong:
      'cycleway:*:oneway is relative to the direction of the way, but the cycle path on this side runs against the way.',
    'cycleway_oneway_wrong.contraflow':
      '{key}={value} is relative to the direction of the way, but the cycle path on this side runs against the way.',
    cycleway_oneway_redundant:
      '{key}={value} is the direction the cycle path on this side runs in anyway.',
    'fix.remove_tags': 'Remove {keys}',
    'fix.set_tag': 'Set {key}={value}',
    'fix.width_part_sum': 'Set width={sum}',
  },
}

export function isMessageLanguage(value: string): value is MessageLanguage {
  return value === 'de' || value === 'en'
}

/** The text of a message in a language, with its parameters filled in. An unknown code returns the code. */
export function renderMessage(message: MessageRef, language: MessageLanguage): string {
  const template = MESSAGES[language][message.code]
  if (template === undefined) return message.code
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = message.params[name]
    return value === undefined ? placeholder : String(value)
  })
}
