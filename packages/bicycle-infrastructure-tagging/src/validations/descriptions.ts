import type { MessageLanguage } from './messages.ts'

/**
 * A plain description of every rule, by rule id: what the rule looks for, in a sentence or two,
 * without placeholders. For a catalogue of all rules, where most rules have no finding and so no
 * message with values. Written for this package, from the conditions of the todos of tilda-geo
 * and of the Radnetz rules.
 */
export const RULE_DESCRIPTIONS: Record<MessageLanguage, Record<string, string>> = {
  de: {
    // tilda-geo
    crossing_too_long:
      'Eine Querung ist länger als 100 m und lässt sich keiner Führungsform zuordnen. Dann ist unklar, wie der Radverkehr dort geführt wird.',
    needs_clarification:
      'Es gibt Radinfrastruktur, aber die Tags reichen nicht, um sie einer Kategorie zuzuordnen. Meist fehlt ein Verkehrszeichen, segregated oder is_sidepath.',
    adjoining_or_isolated:
      'Ein Radweg ist erkennbar, aber es ist unklar, ob er an einer Straße entlang führt oder eigenständig verläuft. Dafür fehlt is_sidepath=yes oder is_sidepath=no.',
    advisory_or_exclusive:
      'Ein Radstreifen auf der Fahrbahn ist erkennbar, aber es ist unklar, ob es ein Schutzstreifen oder ein Radfahrstreifen ist. Dafür fehlt lane=advisory oder lane=exclusive.',
    needs_clarification_track:
      'cycleway=track auf einer Straßenseite reicht nicht, um den Radweg einzuordnen. Es fehlt segregated=yes oder segregated=no, oder ein Verkehrszeichen (DE:237, DE:240, DE:241).',
    mixed_cycleway_both:
      'Die Angaben für beide Seiten einer Straße (cycleway oder cycleway:both) stehen neben Angaben für eine einzelne Seite (cycleway:left oder cycleway:right). Das lässt sich nicht eindeutig lesen.',
    deprecated_cycleway_shared:
      'cycleway=shared ist ein veralteter Wert und wird nicht ausgewertet. Er sollte durch einen genaueren Wert ersetzt oder entfernt werden.',
    unexpected_highway_path:
      'Ein Weg ist nur für Fahrräder bestimmt (bicycle=designated, foot=no), aber als highway=path erfasst; er ist kein Mountainbike-Pfad und hat keine unbefestigte Oberfläche. Erwartet wird highway=cycleway, mit oder ohne Verkehrszeichen DE:237.',
    missing_traffic_sign_vehicle_destination:
      'Eine Fahrradstraße erlaubt Kraftfahrzeugen nur den Zielverkehr („Anlieger frei“), aber das Zusatzzeichen fehlt in traffic_sign. Erwartet wird zum Beispiel DE:244.1,1020-30.',
    missing_traffic_sign_244:
      'Eine Fahrradstraße (bicycle_road=yes) hat kein Verkehrszeichen 244 in traffic_sign. Erwartet wird zum Beispiel DE:244.1.',
    missing_access_tag_bicycle_road:
      'Auf einer Fahrradstraße ist der Verkehr mit Kraftfahrzeugen verboten oder nur für den Zielverkehr erlaubt, aber bicycle=designated fehlt. Das Routing braucht dieses Tag.',
    missing_traffic_sign:
      'Radinfrastruktur hat kein traffic_sign. Erwartet wird ein Verkehrszeichen (DE:…) oder traffic_sign=none, wenn es keines gibt.',
    malformed_traffic_sign:
      'Der Wert von traffic_sign, traffic_sign:both, traffic_sign:forward oder traffic_sign:backward ist nicht in der bereinigten, üblichen Schreibweise. Er sollte aufgeräumt werden.',
    missing_access_tag_240:
      'Ein Verkehrszeichen für einen gemeinsamen oder getrennten Geh- und Radweg (240, 241) ist getaggt, aber es fehlen bicycle=designated und foot=designated.',
    missing_segregated:
      'Ein Geh- und Radweg ist erkennbar (bicycle=designated und foot=designated, oder Verkehrszeichen 240 oder 241), aber es fehlt segregated=yes oder segregated=no.',
    unexpected_bicycle_access_on_footway:
      'Ein Gehweg (highway=footway) hat bicycle=designated. Erwartet wird highway=path mit bicycle=designated (Verkehrszeichen 240) oder highway=footway mit bicycle=yes (Verkehrszeichen 239 mit Zusatz „Radfahrer frei“). traffic_sign=none kennzeichnet einen Weg ohne Schild.',
    missing_width: 'Radinfrastruktur hat keine Breite (width).',
    unusual_width:
      'Die Breite lässt sich nicht lesen (zum Beispiel „narrow“ oder ein Bereich) oder ist größer als 50 m und damit wahrscheinlich ein Tippfehler. Der Wert sollte korrigiert oder mit check_date:width bestätigt werden.',
    missing_surface: 'Radinfrastruktur hat keine Oberfläche (surface).',
    missing_oneway:
      'Ein Weg hat kein ausdrückliches oneway, und die Fahrtrichtung lässt sich nur raten. Für Wege, bei denen das unsicher ist, wird ein oneway erwartet.',
    unexpected_oneway_direction:
      'Ein Radstreifen oder Radweg an einer Straße ohne Einbahn ist so getaggt, dass er gegen den Verkehr seiner Seite fährt (zum Beispiel cycleway:left:oneway=yes). Meist wird „eine Richtung“ mit „Richtung des Weges“ verwechselt.',
    // radnetz
    width_part_sum:
      'Die Breite eines Geh- und Radwegs ist nicht die Summe der Teilbreiten von Radweg (cycleway:width) und Gehweg (footway:width).',
    width_part_whole:
      'Die Breite des Radwegteils oder des Gehwegteils ist so groß wie die des ganzen Weges. Für den anderen Teil bleibt nichts übrig.',
    width_part_unsegregated:
      'Ein Weg mit segregated=no hat Teilbreiten (cycleway:width, footway:width). Ohne Trennung gibt es nur eine Breite für den ganzen Weg.',
    cycleway_oneway_wrong:
      'An einer Einbahnstraße steht cycleway:…:oneway=yes, aber der Radweg dieser Seite fährt gegen die Richtung des gezeichneten Weges (oneway:bicycle=no). oneway gilt in Richtung des Weges, gemeint wäre also -1.',
    cycleway_oneway_redundant:
      'cycleway:…:oneway nennt die Richtung, in der der Radweg dieser Seite ohnehin fährt. Das Tag ist überflüssig.',
  },
  en: {
    crossing_too_long:
      'A crossing is longer than 100 m and cannot be assigned to a guidance form. Then it is unclear how bicycles are guided there.',
    needs_clarification:
      'There is bike infrastructure, but the tags are not enough to assign a category. Usually a traffic sign, segregated or is_sidepath is missing.',
    adjoining_or_isolated:
      'A cycle path is recognizable, but it is unclear whether it runs along a road or on its own. It needs is_sidepath=yes or is_sidepath=no.',
    advisory_or_exclusive:
      'A cycle lane on the carriageway is recognizable, but it is unclear whether it is an advisory lane or an exclusive lane. It needs lane=advisory or lane=exclusive.',
    needs_clarification_track:
      'cycleway=track on a road side is not enough to categorize the cycle path. It needs segregated=yes or segregated=no, or a traffic sign (DE:237, DE:240, DE:241).',
    mixed_cycleway_both:
      'The tags for both sides of a road (cycleway or cycleway:both) are mixed with tags for a single side (cycleway:left or cycleway:right). This cannot be read unambiguously.',
    deprecated_cycleway_shared:
      'cycleway=shared is a deprecated value and is not evaluated. Replace it with a more precise value or remove it.',
    unexpected_highway_path:
      'A way is meant for bicycles only (bicycle=designated, foot=no) but mapped as highway=path; it is no mountain bike trail and has no unpaved surface. Expected is highway=cycleway, with or without traffic sign DE:237.',
    missing_traffic_sign_vehicle_destination:
      'A bicycle road allows motor vehicles for destination traffic only ("Anlieger frei"), but the additional sign is missing in traffic_sign. Expected is for example DE:244.1,1020-30.',
    missing_traffic_sign_244:
      'A bicycle road (bicycle_road=yes) has no traffic sign 244 in traffic_sign. Expected is for example DE:244.1.',
    missing_access_tag_bicycle_road:
      'Motor vehicles are forbidden or allowed for destination traffic only on a bicycle road, but bicycle=designated is missing. Routing needs this tag.',
    missing_traffic_sign:
      'Bike infrastructure has no traffic_sign. Expected is a traffic sign (DE:…), or traffic_sign=none if there is none.',
    malformed_traffic_sign:
      'The value of traffic_sign, traffic_sign:both, traffic_sign:forward or traffic_sign:backward is not in the cleaned-up, usual spelling. It should be tidied up.',
    missing_access_tag_240:
      'A traffic sign for a shared or segregated foot and cycle path (240, 241) is tagged, but bicycle=designated and foot=designated are missing.',
    missing_segregated:
      'A foot and cycle path is recognizable (bicycle=designated and foot=designated, or traffic sign 240 or 241), but segregated=yes or segregated=no is missing.',
    unexpected_bicycle_access_on_footway:
      'A footway (highway=footway) has bicycle=designated. Expected is highway=path with bicycle=designated (traffic sign 240) or highway=footway with bicycle=yes (traffic sign 239 with the additional sign "Radfahrer frei"). traffic_sign=none marks a path without a sign.',
    missing_width: 'Bike infrastructure has no width (width).',
    unusual_width:
      'The width cannot be read (for example "narrow" or a range) or is larger than 50 m and probably a typo. Fix the value or confirm it with check_date:width.',
    missing_surface: 'Bike infrastructure has no surface (surface).',
    missing_oneway:
      'A way has no explicit oneway and its direction can only be guessed. For ways where that is uncertain, a oneway is expected.',
    unexpected_oneway_direction:
      'A cycle lane or cycle path on a road that is not one-way is tagged to run against the traffic of its side (for example cycleway:left:oneway=yes). Usually "one direction" was mixed up with "direction of the way".',
    width_part_sum:
      'The width of a foot and cycle path is not the sum of the part widths of the cycleway (cycleway:width) and the footway (footway:width).',
    width_part_whole:
      'The width of the cycleway part or the footway part is as wide as the whole way. Nothing is left for the other part.',
    width_part_unsegregated:
      'A way with segregated=no has part widths (cycleway:width, footway:width). Without a separation there is only one width for the whole way.',
    cycleway_oneway_wrong:
      'On a one-way road, cycleway:…:oneway=yes is tagged, but the cycle path on this side runs against the direction of the drawn way (oneway:bicycle=no). oneway is relative to the direction of the way, so -1 is meant.',
    cycleway_oneway_redundant:
      'cycleway:…:oneway names the direction the cycle path on this side runs in anyway. The tag is not needed.',
  },
}

/** The description of a rule (by id), or `undefined` for an id without one. */
export function ruleDescription(ruleId: string, language: MessageLanguage): string | undefined {
  return RULE_DESCRIPTIONS[language][ruleId]
}
