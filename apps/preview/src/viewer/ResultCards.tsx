import {
  analyzeCategoryGaps,
  type BikelaneResult,
  type OsmTags,
} from '@tilda-geo/bicycle-infrastructure'
import {
  TILDA_LABELS,
  categoryLabel,
  gapWriteKey,
  type ResultSide,
} from '@tilda-geo/bicycle-infrastructure-tagging'
import clsx from 'clsx'
import { Badge, BadgeButton } from '../components/catalyst/badge'
import { SIDE_LABEL } from './copy'
import { Tag } from './Section'

const FIELDS: { field: keyof BikelaneResult; label: string }[] = [
  { field: 'lifecycle', label: 'Lebenszyklus' },
  { field: 'oneway', label: 'Fahrtrichtung' },
  { field: 'width', label: 'Breite (m)' },
  { field: 'surface', label: 'Oberfläche' },
  { field: 'smoothness', label: 'Zustand' },
  { field: 'surface_color', label: 'Farbe' },
  { field: 'traffic_sign', label: 'Verkehrszeichen' },
  { field: 'separation_left', label: 'Trennung links' },
  { field: 'separation_right', label: 'Trennung rechts' },
  { field: 'traffic_mode_left', label: 'Verkehr links' },
  { field: 'traffic_mode_right', label: 'Verkehr rechts' },
  { field: 'marking_left', label: 'Markierung links' },
  { field: 'marking_right', label: 'Markierung rechts' },
  { field: 'buffer_left', label: 'Puffer links' },
  { field: 'buffer_right', label: 'Puffer rechts' },
]

type Props = {
  tags: OsmTags
  results: BikelaneResult[]
  side: ResultSide | undefined
  onSelect: (side: ResultSide) => void
  /** A gap was answered: add this tag */
  onSetTag: (key: string, value: string) => void
}

export function ResultCards({ tags, results, side, onSelect, onSetTag }: Props) {
  if (!results.length) {
    return (
      <p className="text-sm/6 text-zinc-500">
        Kein Ergebnis. <code className="font-mono">processBikelanes</code> braucht mindestens ein{' '}
        <code className="font-mono">highway</code>-Tag.
      </p>
    )
  }
  const gaps = analyzeCategoryGaps(tags, results)

  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="results">
      {results.map((result, index) => {
        const selected = result._side === side
        const missing = gaps[index]?.missing ?? []
        return (
          <li
            key={result._side}
            className={clsx(
              'flex h-full flex-col rounded-lg ring-1 transition',
              selected
                ? 'bg-sky-50 ring-2 ring-sky-500'
                : 'bg-white ring-zinc-950/10 hover:ring-zinc-950/20',
            )}
          >
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(result._side)}
              className="block w-full cursor-pointer rounded-lg p-4 text-left"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm/6 text-zinc-500">
                <span className="font-medium text-zinc-950">{SIDE_LABEL[result._side]}</span>
                <Tag k="_side" v={result._side} />
                {result._prefix && <Tag k="_prefix" v={result._prefix} />}
                {!result._infrastructureExists && <Badge>keine Radinfrastruktur</Badge>}
              </div>
              <p
                className="mt-2 text-base/6 font-semibold text-zinc-950"
                data-testid="category-label"
              >
                {categoryLabel(result.category, TILDA_LABELS.de) ?? result.category}
              </p>
              <p className="font-mono text-xs/5 text-zinc-500" data-testid="category-id">
                {result.category}
              </p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm/5">
                {FIELDS.map(({ field, label }) => {
                  const value = result[field]
                  if (value === null || value === undefined) return null
                  return (
                    <div key={field} className="contents">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="font-mono text-xs/5 break-all text-zinc-950">
                        {String(value)}
                      </dd>
                    </div>
                  )
                })}
                {!!result.todos?.length && (
                  <div className="contents">
                    <dt className="text-zinc-500">Todos</dt>
                    <dd className="font-mono text-xs/5 break-all text-zinc-950">
                      {result.todos.join(', ')}
                    </dd>
                  </div>
                )}
              </dl>
            </button>
            {!!missing.length && (
              <div className="mx-4 mb-4 rounded-md bg-amber-50 p-3 text-sm/5" data-testid="gaps">
                <p className="font-medium text-amber-900">Diese Tags würden entscheiden:</p>
                <ul className="mt-1 space-y-2">
                  {missing.map((gap) => {
                    const key = gapWriteKey(gap, result)
                    return (
                      <li
                        key={`${gap.key}=${gap.values.join('|')}`}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-amber-900"
                      >
                        {gap.values.map((value) => (
                          <BadgeButton
                            key={value}
                            color="amber"
                            data-testid="gap-button"
                            title={`${key}=${value} hinzufügen`}
                            onClick={() => onSetTag(key, value)}
                          >
                            {key}={value}
                          </BadgeButton>
                        ))}
                        {gap.unlocksCategory && (
                          <span>
                            →{' '}
                            {categoryLabel(gap.unlocksCategory, TILDA_LABELS.de) ??
                              gap.unlocksCategory}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
