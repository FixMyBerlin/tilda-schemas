import type { BikelaneResult, OsmTags } from '@tilda-geo/bicycle-infrastructure'
import {
  MAPPING_TARGET_GROUP_LABELS,
  MAPPING_TARGET_LABELS,
  TILDA_LABELS,
  applyCategoryPlan,
  categoryLabel,
  groupMappingTargets,
  mappingTargetById,
  planCategoryVariants,
  planForMappingTarget,
  renderPlanConflict,
  renderPlanReason,
  type CategoryChangePlan,
} from '@tilda-geo/bicycle-infrastructure-tagging'
import clsx from 'clsx'
import { Badge } from '../components/catalyst/badge'
import { Button } from '../components/catalyst/button'
import { Field, Label } from '../components/catalyst/fieldset'
import { Select } from '../components/catalyst/select'
import { SIDE_LABEL } from './copy'
import { Tag } from './Section'

type Props = {
  tags: OsmTags
  result: BikelaneResult
  targetId: string | undefined
  onTarget: (targetId: string | undefined) => void
  onApply: (tags: OsmTags) => void
}

const TEXT_OPTIONS = { categoryLabels: TILDA_LABELS.de }

const targetLabel = (id: string | undefined) => {
  const target = id ? mappingTargetById(id) : undefined
  return target ? (MAPPING_TARGET_LABELS.de[target.labelCode] ?? target.id) : undefined
}

export function TargetPlan({ tags, result, targetId, onTarget, onApply }: Props) {
  const target = targetId ? mappingTargetById(targetId) : undefined
  const plan = target ? planForMappingTarget(tags, target.id, result._side) : undefined
  const variants = target
    ? planCategoryVariants(tags, target.categoryId, result._side).filter(
        (variant) => variant.mappingTargetId !== target.id,
      )
    : []

  return (
    <div className="space-y-3">
      <Field>
        <Label className="sr-only">Ziel für {SIDE_LABEL[result._side]}</Label>
        <Select
          name="target"
          value={target?.id ?? ''}
          onChange={(event) => onTarget(event.target.value || undefined)}
        >
          <option value="">Ziel wählen …</option>
          {groupMappingTargets().map((group) => (
            <optgroup key={group.id} label={MAPPING_TARGET_GROUP_LABELS.de[group.id]}>
              {group.targets.map((option) => (
                <option key={option.id} value={option.id}>
                  {MAPPING_TARGET_LABELS.de[option.labelCode] ?? option.id}
                  {option.categoryId === result.category ? ' (aktuell)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      {target && plan && (
        <>
          <PlanCard
            title={targetLabel(target.id) ?? target.id}
            plan={plan}
            primary
            tags={tags}
            onApply={onApply}
          />
          {!!variants.length && (
            <div>
              <h3 className="text-sm/6 font-semibold text-zinc-950">
                Weitere Wege zu „
                {categoryLabel(target.categoryId, TILDA_LABELS.de) ?? target.categoryId}“
              </h3>
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                {variants.map((variant) => (
                  <PlanCard
                    key={variant.variantId}
                    title={
                      variant.variantId === 'default'
                        ? 'Vorschlag des Planers (wenigste Änderungen)'
                        : (targetLabel(variant.mappingTargetId) ?? variant.variantId)
                    }
                    plan={variant}
                    tags={tags}
                    onApply={onApply}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PlanCard({
  title,
  plan,
  primary,
  tags,
  onApply,
}: {
  title: string
  plan: CategoryChangePlan
  primary?: boolean
  tags: OsmTags
  onApply: (tags: OsmTags) => void
}) {
  const edits = plan.add.length + plan.change.length + plan.remove.length
  return (
    <article
      data-testid={primary ? 'plan' : 'plan-variant'}
      className={clsx(
        'rounded-lg p-3 ring-1',
        primary ? 'bg-white ring-zinc-950/15' : 'bg-zinc-50 ring-zinc-950/5',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm/6 font-semibold text-zinc-950">{title}</h4>
          <p className="font-mono text-xs/5 text-zinc-500">{plan.variantId}</p>
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

      {!!edits &&
        (primary ? (
          <Button
            className="mt-3"
            color="dark/zinc"
            onClick={() => onApply(applyCategoryPlan(tags, plan))}
          >
            Plan übernehmen
          </Button>
        ) : (
          <Button className="mt-3" outline onClick={() => onApply(applyCategoryPlan(tags, plan))}>
            Plan übernehmen
          </Button>
        ))}
    </article>
  )
}
