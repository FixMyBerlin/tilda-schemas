import type { BikelaneResult, OsmTags } from '@tilda-geo/bicycle-infrastructure'
import {
  ATTRIBUTE_STATE_TEXTS,
  TILDA_LABELS,
  attributeFeedsText,
  attributeHint,
  attributeLabel,
  attributeNote,
  attributeStateLabel,
  categoryLabel,
  isRoad,
  reminderText,
  reminders,
  requiredAttributes,
  roadAttributes,
  type RequiredAttribute,
  type RequirementsProfile,
} from '@tilda-geo/bicycle-infrastructure-tagging'
import { Badge, BadgeButton } from '../components/catalyst/badge'
import { STATE_COLOR } from './copy'
import { Tag } from './Section'

type Props = {
  tags: OsmTags
  result: BikelaneResult
  profile: RequirementsProfile
  targetCategory: string | undefined
  onSetTag: (key: string, value: string) => void
}

export function Requirements({ tags, result, profile, targetCategory, onSetTag }: Props) {
  const attributes = requiredAttributes(result, tags, { profile, targetCategory })
  const road = result._side === 'self' && isRoad(tags) ? roadAttributes(tags, { profile }) : []
  const reminderIds = reminders(result, tags, profile, targetCategory)
  const category = targetCategory ?? result.category

  return (
    <div className="space-y-5">
      <p className="text-sm/6 text-zinc-500">
        Für „{categoryLabel(category, TILDA_LABELS.de) ?? category}“{targetCategory && ' (Ziel)'},
        Profil <code className="font-mono">{profile.id}</code>.
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
          <ul className="mt-1 space-y-2" data-testid="reminders">
            {reminderIds.map((id) => {
              const text = reminderText(id, 'de')
              return (
                <li key={id} className="rounded-md bg-sky-50 p-3 text-sm/5">
                  <p className="font-medium text-sky-900">{text?.title ?? id}</p>
                  {text && <p className="mt-0.5 text-sky-900">{text.text}</p>}
                </li>
              )
            })}
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
      {attributes.map((attribute) => {
        const note = attributeNote(attribute, 'de')
        const hint = attributeHint(attribute, 'de')
        const feeds = attributeFeedsText(attribute, 'de')
        return (
          <li key={attribute.key} className="grid gap-2 py-3 sm:grid-cols-[15rem_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-sm/6 font-medium text-zinc-950"
                  data-testid="attribute-label"
                  title={attribute.id}
                >
                  {attributeLabel(attribute.id, 'de')}
                </span>
                <Badge color={STATE_COLOR[attribute.state]} title={attribute.state}>
                  {attributeStateLabel(attribute.state, 'de')}
                </Badge>
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
              {!attribute.tagged.length && attribute.state !== 'inherited' && (
                <p className="text-zinc-500">
                  <Tag k={attribute.key} />{' '}
                  {
                    ATTRIBUTE_STATE_TEXTS.de[
                      attribute.state === 'assumed' ? 'not_tagged' : 'missing'
                    ]
                  }
                </p>
              )}
              {note && <p className="text-zinc-600">{note}</p>}
              {attribute.default && (
                <p>
                  Standard: <code className="font-mono text-xs">{attribute.default}</code>
                </p>
              )}
              {hint && hint !== note && <p className="text-zinc-500">{hint}</p>}
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
              {feeds && <p className="text-xs/5 text-zinc-500">{feeds}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
