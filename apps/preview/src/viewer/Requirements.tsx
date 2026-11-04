import type { BikelaneResult, OsmTags } from '@tilda-geo/bicycle-infrastructure'
import {
  TILDA_LABELS,
  categoryLabel,
  isRoad,
  reminders,
  requiredAttributes,
  roadAttributes,
  type RequiredAttribute,
} from '@tilda-geo/bicycle-infrastructure-tagging'
import { radnetzBerlin } from '@tilda-geo/bicycle-infrastructure-tagging/profiles/radnetz-berlin'
import { Badge, BadgeButton } from '../components/catalyst/badge'
import { STATE_COLOR } from './copy'
import { Tag } from './Section'

type Props = {
  tags: OsmTags
  result: BikelaneResult
  targetCategory: string | undefined
  onSetTag: (key: string, value: string) => void
}

export function Requirements({ tags, result, targetCategory, onSetTag }: Props) {
  const attributes = requiredAttributes(result, tags, { profile: radnetzBerlin, targetCategory })
  const road =
    result._side === 'self' && isRoad(tags) ? roadAttributes(tags, { profile: radnetzBerlin }) : []
  const reminderIds = reminders(result, tags, radnetzBerlin, targetCategory)
  const category = targetCategory ?? result.category

  return (
    <div className="space-y-5">
      <p className="text-sm/6 text-zinc-500">
        Für „{categoryLabel(category, TILDA_LABELS.de) ?? category}“{targetCategory && ' (Ziel)'},
        Profil <code className="font-mono">{radnetzBerlin.id}</code>.
      </p>
      <AttributeTable attributes={attributes} onSetTag={onSetTag} />
      {!!road.length && (
        <div>
          <h3 className="text-sm/6 font-semibold text-zinc-950">Straße</h3>
          <AttributeTable attributes={road} onSetTag={onSetTag} />
        </div>
      )}
      {!!reminderIds.length && (
        <div>
          <h3 className="text-sm/6 font-semibold text-zinc-950">Erinnerungen</h3>
          <ul className="mt-1 flex flex-wrap gap-2">
            {reminderIds.map((id) => (
              <li key={id}>
                <Badge color="sky">{id}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AttributeTable({
  attributes,
  onSetTag,
}: {
  attributes: RequiredAttribute[]
  onSetTag: (key: string, value: string) => void
}) {
  if (!attributes.length) return <p className="text-sm/6 text-zinc-500">Keine Pflichtangaben.</p>
  return (
    <ul className="divide-y divide-zinc-950/5" data-testid="attributes">
      {attributes.map((attribute) => (
        <li key={attribute.key} className="grid gap-2 py-3 sm:grid-cols-[15rem_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm/6 font-medium break-all text-zinc-950">
                {attribute.id}
              </span>
              <Badge color={STATE_COLOR[attribute.state]}>{attribute.state}</Badge>
              {attribute.optional && <Badge>optional</Badge>}
            </div>
            <p className="mt-0.5 font-mono text-xs/5 break-all text-zinc-500">{attribute.key}</p>
          </div>
          <div className="space-y-1 text-sm/5">
            {attribute.tagged.map((tag) => (
              <p key={tag.key}>
                getaggt: <Tag k={tag.key} v={tag.value} />
              </p>
            ))}
            {attribute.tilda !== undefined && (
              <p>
                TILDA liest: <code className="font-mono text-xs">{attribute.tilda}</code>
                {attribute.source && (
                  <>
                    {' '}
                    aus <code className="font-mono text-xs">{attribute.source}</code>
                  </>
                )}
              </p>
            )}
            {attribute.default && (
              <p>
                Standard: <code className="font-mono text-xs">{attribute.default}</code>
              </p>
            )}
            {(attribute.note || attribute.hint) && (
              <p className="text-zinc-500">
                Text: <code className="font-mono text-xs">{attribute.note ?? attribute.hint}</code>
              </p>
            )}
            {!!attribute.options.length && (
              <div className="flex flex-wrap gap-1">
                {attribute.options.map((option) => (
                  <BadgeButton
                    key={option}
                    color={attribute.value === option ? 'green' : 'zinc'}
                    onClick={() => onSetTag(attribute.key, option)}
                  >
                    {option}
                  </BadgeButton>
                ))}
              </div>
            )}
            {!!attribute.feeds.length && (
              <p className="text-xs/5 text-zinc-500">infraVelo: {attribute.feeds.join(', ')}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
