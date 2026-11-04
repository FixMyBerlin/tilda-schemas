import type { OsmTags } from '@tilda-geo/bicycle-infrastructure'
import { useState } from 'react'
import { Button } from '../components/catalyst/button'
import { Field, Label, Description } from '../components/catalyst/fieldset'
import { Textarea } from '../components/catalyst/textarea'
import { parseTagsText, serializeTagsParam, tagsToText } from './tagsParam'

type Props = {
  tags: OsmTags
  onChange: (tags: OsmTags) => void
}

export function TagInput({ tags, onChange }: Props) {
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
      <Label>Tags</Label>
      <Description>Ein Tag pro Zeile, als key=value.</Description>
      <Textarea
        name="tags"
        rows={8}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        className="mt-3 font-mono"
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={'highway=cycleway\nbicycle=designated'}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button outline onClick={copyTags} disabled={!Object.keys(tags).length}>
          {copied ? 'Kopiert' : 'Tags kopieren'}
        </Button>
        <Button plain onClick={() => onChange({})} disabled={!Object.keys(tags).length}>
          Leeren
        </Button>
      </div>
    </Field>
  )
}
