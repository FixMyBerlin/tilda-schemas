import type { ResultSide } from '@tilda-geo/bicycle-infrastructure-tagging'

// UI copy of the viewer. Category, mapping target and rule texts come from the packages.

export const SIDE_LABEL: Record<ResultSide, string> = {
  self: 'Dieser Weg',
  left: 'Linke Seite',
  right: 'Rechte Seite',
}

export const SEVERITY_LABEL = { error: 'Fehler', warning: 'Warnung', info: 'Hinweis' } as const

export const SEVERITY_COLOR = { error: 'red', warning: 'amber', info: 'sky' } as const

export const STATE_COLOR = {
  ok: 'green',
  inherited: 'teal',
  assumed: 'zinc',
  guess: 'amber',
  ignored: 'red',
  missing: 'red',
} as const

export const QA_COLOR = { complete: 'green', incomplete: 'amber', unclear: 'red' } as const
