import type { BikelaneResult, OsmTags } from '@tilda-geo/bicycle-infrastructure'
import {
  MAPPING_OPTION_LABELS,
  MAPPING_TARGET_GROUP_LABELS,
  TILDA_LABELS,
  applyCategoryPlan,
  groupMappingKinds,
  mappingChoiceForCategory,
  mappingChoiceLabel,
  mappingChoiceOptions,
  mappingKindLabel,
  normalizeMappingChoice,
  planForMappingChoice,
  renderPlanConflict,
  renderPlanReason,
  type CategoryChangePlan,
  type MappingChoice,
} from '@tilda-geo/bicycle-infrastructure-tagging'
import clsx from 'clsx'
import { Badge } from '../components/catalyst/badge'
import { Button } from '../components/catalyst/button'
import { Field, Label } from '../components/catalyst/fieldset'
import { Select } from '../components/catalyst/select'
import { searchFromChoice, type ChoiceSearch } from './choice'
import { SIDE_LABEL } from './copy'
import { Tag } from './Section'

type Props = {
  tags: OsmTags
  result: BikelaneResult
  /** The choice of the URL; `undefined` while no kind is picked */
  choice: MappingChoice | undefined
  onChoice: (search: ChoiceSearch) => void
  onApply: (tags: OsmTags) => void
}

const TEXT_OPTIONS = { categoryLabels: TILDA_LABELS.de }
const WORDS = MAPPING_OPTION_LABELS.de

type OptionRow = {
  axis: 'position' | 'sign' | 'lines' | 'lifecycle'
  label: string
  /** `value` is what the choice gets; `undefined` is "not set" */
  buttons: { value: string | undefined; label: string }[]
}

/** The rows that apply to the choice, in the order Lage, Beschilderung, Linien, Zustand */
function optionRows(choice: MappingChoice, side: BikelaneResult['_side']): OptionRow[] {
  const options = mappingChoiceOptions(choice, side)
  const rows: OptionRow[] = []
  if (options.position.length > 1) {
    rows.push({
      axis: 'position',
      label: WORDS.position,
      buttons: options.position.map((value) => ({ value, label: WORDS[value] })),
    })
  }
  if (options.sign.length) {
    rows.push({
      axis: 'sign',
      label: WORDS.sign,
      buttons: [
        { value: undefined, label: WORDS.asIs },
        ...options.sign.map((value) => ({
          value,
          label:
            value === 'signed' && options.signValue
              ? `${WORDS.signed} (${options.signValue})`
              : WORDS[value],
        })),
      ],
    })
  }
  if (options.lines.length > 1) {
    rows.push({
      axis: 'lines',
      label: WORDS.lines,
      buttons: options.lines.map((value) => ({
        // "one" is not set: the choice keeps the lines the way has
        value: value === 'one' ? undefined : value,
        label: WORDS[value],
      })),
    })
  }
  if (options.lifecycle.length) {
    rows.push({
      axis: 'lifecycle',
      label: WORDS.lifecycle,
      buttons: [
        { value: undefined, label: WORDS.built },
        ...options.lifecycle.map((value) => ({ value, label: WORDS[value] })),
      ],
    })
  }
  return rows
}

export function TargetPlan({ tags, result, choice, onChoice, onApply }: Props) {
  const side = result._side
  const normalized = choice ? normalizeMappingChoice(choice, side) : undefined
  const plan = normalized ? planForMappingChoice(tags, normalized, side) : undefined
  const rows = normalized ? optionRows(normalized, side) : []
  const currentKind = mappingChoiceForCategory(result.category)?.kind

  const setChoice = (next: MappingChoice) => {
    const settled = normalizeMappingChoice(next, side)
    onChoice(
      searchFromChoice(settled, mappingChoiceOptions({ kind: settled.kind }, side).position[0]),
    )
  }

  return (
    <div className="space-y-3">
      <Field>
        <Label className="sr-only">Art für {SIDE_LABEL[side]}</Label>
        <Select
          name="kind"
          value={normalized?.kind ?? ''}
          onChange={(event) => {
            const kind = event.target.value
            if (!kind) return onChoice(searchFromChoice(undefined))
            // the options that are still possible stay
            setChoice({ kind, sign: normalized?.sign, lifecycle: normalized?.lifecycle })
          }}
        >
          <option value="">Art wählen …</option>
          {groupMappingKinds().map((group) => (
            <optgroup key={group.id} label={MAPPING_TARGET_GROUP_LABELS.de[group.id]}>
              {group.kinds.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {mappingKindLabel(kind.id, 'de')}
                  {kind.id === currentKind ? ' (aktuell)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      {normalized && !!rows.length && (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const current = normalized[row.axis]
            return (
              <div
                key={row.axis}
                role="group"
                aria-label={row.label}
                data-testid={`option-${row.axis}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                <span className="w-28 shrink-0 text-sm/6 text-zinc-500">{row.label}</span>
                <div className="flex flex-wrap gap-1">
                  {row.buttons.map((button) => {
                    const pressed = button.value === current
                    return (
                      <button
                        key={button.value ?? 'none'}
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => setChoice({ ...normalized, [row.axis]: button.value })}
                        className={clsx(
                          'rounded-md px-2.5 py-1 text-sm/5 ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                          pressed
                            ? 'bg-zinc-900 text-white ring-zinc-900'
                            : 'bg-white text-zinc-950 ring-zinc-950/10 hover:bg-zinc-50',
                        )}
                      >
                        {button.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {normalized && plan && (
        <PlanCard
          title={mappingChoiceLabel(normalized, 'de')}
          plan={plan}
          tags={tags}
          onApply={onApply}
        />
      )}
    </div>
  )
}

function PlanCard({
  title,
  plan,
  tags,
  onApply,
}: {
  title: string
  plan: CategoryChangePlan
  tags: OsmTags
  onApply: (tags: OsmTags) => void
}) {
  const edits = plan.add.length + plan.change.length + plan.remove.length
  return (
    <article data-testid="plan" className="rounded-lg bg-white p-3 ring-1 ring-zinc-950/15">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm/6 font-semibold text-zinc-950">{title}</h4>
          <p className="font-mono text-xs/5 text-zinc-500">{plan.choiceId}</p>
        </div>
        {plan.conflicts.length ? (
          <Badge color="red">Konflikt</Badge>
        ) : plan.aligned ? (
          <Badge color="green">ergibt das Ziel</Badge>
        ) : (
          <Badge color="amber">ergibt das Ziel nicht</Badge>
        )}
      </div>

      {!edits && !plan.conflicts.length && (
        <p className="mt-2 text-sm/6 text-zinc-500">Nichts zu tun, die Tags passen schon.</p>
      )}

      <ul className="mt-2 space-y-1 text-sm/5">
        {plan.add.map((entry) => (
          <li key={`add-${entry.key}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="w-4 font-mono text-green-700" aria-label="hinzufügen">
              +
            </span>
            <Tag k={entry.key} v={entry.value} />
            <span className="text-xs/5 text-zinc-500" title={entry.reasonCode ?? entry.code}>
              {renderPlanReason(entry, 'de', TEXT_OPTIONS)}
            </span>
          </li>
        ))}
        {plan.change.map((entry) => (
          <li key={`change-${entry.key}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="w-4 font-mono text-amber-700" aria-label="ändern">
              ~
            </span>
            <Tag k={entry.key} v={entry.from} />
            <span>→</span>
            <Tag k={entry.key} v={entry.to} />
            <span className="text-xs/5 text-zinc-500" title={entry.reasonCode ?? entry.code}>
              {renderPlanReason(entry, 'de', TEXT_OPTIONS)}
            </span>
          </li>
        ))}
        {plan.remove.map((key) => (
          <li key={`remove-${key}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="w-4 font-mono text-red-700" aria-label="entfernen">
              −
            </span>
            <Tag k={key} v={tags[key]} />
          </li>
        ))}
      </ul>

      {!!plan.conflicts.length && (
        <ul className="mt-2 space-y-1 rounded-md bg-red-50 p-3 text-sm/5 text-red-900">
          {plan.conflicts.map((conflict) => (
            <li key={`${conflict.code}-${conflict.key}`} title={conflict.code}>
              {renderPlanConflict(conflict, 'de', TEXT_OPTIONS)}
            </li>
          ))}
        </ul>
      )}

      {!!edits && (
        <Button
          className="mt-3"
          color="dark/zinc"
          onClick={() => onApply(applyCategoryPlan(tags, plan))}
        >
          Plan übernehmen
        </Button>
      )}
    </article>
  )
}
