import type { OsmTags } from '@tilda-geo/bicycle-infrastructure'
import { useState } from 'react'
import { Field, Label, Description } from '../components/catalyst/fieldset'
import { Textarea } from '../components/catalyst/textarea'
import { parseTagsText, serializeTagsParam, tagsToText } from './tagsParam'

/** A small action next to a label */
const TEXT_BUTTON =
  'cursor-pointer text-zinc-500 underline decoration-zinc-950/20 hover:text-zinc-950 disabled:cursor-default disabled:no-underline disabled:opacity-50'

type Props = {
  tags: OsmTags
  onChange: (tags: OsmTags) => void
}

export function TagInput({ tags, onChange }: Props) {
  const empty = !Object.keys(tags).length
  const param = serializeTagsParam(tags)
  const [draft, setDraft] = useState(() => tagsToText(tags))
  const [draftParam, setDraftParam] = useState(param)
  const [copied, setCopied] = useState(false)

  // The tags changed from outside (example link, applied plan or fix): show them. While typing, the
  // draft keeps lines that are not complete yet.
  if (param !== draftParam) {
    setDraftParam(param)
    setDraft(tagsToText(tags))
  }

  const handleChange = (text: string) => {
    setDraft(text)
    const next = parseTagsText(text)
    setDraftParam(serializeTagsParam(next))
    onChange(next)
  }

  const copyTags = async () => {
    await navigator.clipboard.writeText(tagsToText(tags))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <Label>Tags</Label>
        <div className="flex gap-3 text-xs/5">
          <button type="button" className={TEXT_BUTTON} onClick={copyTags} disabled={empty}>
            {copied ? 'Kopiert' : 'Kopieren'}
          </button>
          <button
            type="button"
            className={TEXT_BUTTON}
            onClick={() => onChange({})}
            disabled={empty}
          >
            Leeren
          </button>
        </div>
      </div>
      <Description>Ein Tag pro Zeile, als key=value.</Description>
      <Textarea
        name="tags"
        rows={6}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        className="mt-2 font-mono"
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={'highway=cycleway\nbicycle=designated'}
      />
    </Field>
  )
}
