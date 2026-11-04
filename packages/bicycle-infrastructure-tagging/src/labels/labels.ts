import tildaLabelsDe from './data/tilda-labels.de.json' with { type: 'json' }

/**
 * Labels as TILDA shows them, generated from tilda-geo's processed topic docs
 * (`bun run update-labels`, see `scripts/update-labels.ts`). Keys like `category=cycleway_adjoining`
 * or `adjoining_road=cycleway`. tilda-geo has German labels only; other languages are added the
 * day its topic docs have them.
 */
export type LabelMap = Readonly<Record<string, string>>

export type LabelLanguage = 'de'

export const TILDA_LABELS: Readonly<Record<LabelLanguage, LabelMap>> = {
  de: tildaLabelsDe,
}

/** Group names of `CATEGORY_GROUPS` (our own, tilda-geo has no groups for this list). */
export const CATEGORY_GROUP_LABELS: Readonly<Record<LabelLanguage, LabelMap>> = {
  de: {
    track: 'Radwege',
    lane: 'Auf der Fahrbahn',
    foot: 'Mit dem Fußverkehr',
    bus: 'Mit dem Busverkehr',
    bicycle_road: 'Fahrradstraßen',
    special: 'Sonderfälle: Verbindungsstücke und Querungen',
    other: 'Weitere',
  },
}

export function isLabelLanguage(lang: string): lang is LabelLanguage {
  return lang in TILDA_LABELS
}

/**
 * The label of a category, or `undefined` when the map has none (then the app uses its own text).
 * Pass `TILDA_LABELS.de` or a map of your own.
 */
export function categoryLabel(category: string, labels: LabelMap): string | undefined {
  return labels[`category=${category}`]
}

/** The label of a group of `CATEGORY_GROUPS`, or `undefined` when there is none. */
export function categoryGroupLabel(group: string, lang: LabelLanguage): string | undefined {
  return CATEGORY_GROUP_LABELS[lang][group]
}
