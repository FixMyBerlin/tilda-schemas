import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  processBikelanes,
  type BikelaneResult,
  type OsmTags,
} from '@tilda-geo/bicycle-infrastructure'
import { mappingTargetById, tildaQaState } from '@tilda-geo/bicycle-infrastructure-tagging'
import { radnetzBerlin } from '@tilda-geo/bicycle-infrastructure-tagging/profiles/radnetz-berlin'
import { Badge } from '../components/catalyst/badge'
import { Description, Label } from '../components/catalyst/fieldset'
import { Switch, SwitchField } from '../components/catalyst/switch'
import { QA_COLOR } from '../viewer/copy'
import { ExampleList } from '../viewer/ExampleList'
import { Requirements } from '../viewer/Requirements'
import { ResultCards } from '../viewer/ResultCards'
import { DEFAULT_PROFILE, viewerSearchSchema, type ViewerSearch } from '../viewer/search'
import { Section } from '../viewer/Section'
import { TagInput } from '../viewer/TagInput'
import { parseTagsParam, serializeTagsParam } from '../viewer/tagsParam'
import { TargetPlan } from '../viewer/TargetPlan'
import { ValidationList } from '../viewer/ValidationList'

export const Route = createFileRoute('/')({
  validateSearch: viewerSearchSchema,
  component: Viewer,
})

function bikelanes(tags: OsmTags): BikelaneResult[] {
  if (!tags.highway) return []
  try {
    return processBikelanes(tags)
  } catch {
    return []
  }
}

function Viewer() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })

  const updateSearch = (partial: Partial<ViewerSearch>) => {
    void navigate({
      replace: true,
      search: (prev) => {
        const next: Record<string, unknown> = { ...prev }
        for (const [key, value] of Object.entries(partial)) {
          if (value === undefined || value === '') delete next[key]
          else next[key] = value
        }
        return next as ViewerSearch
      },
    })
  }
  const setTags = (tags: OsmTags) => updateSearch({ tags: serializeTagsParam(tags) })

  const tagsParam = search.tags ?? ''
  const tags = parseTagsParam(tagsParam)
  const profile = search.profile ?? DEFAULT_PROFILE
  const results = bikelanes(tags)
  const result = results.find((r) => r._side === search.side) ?? results[0]
  const target = search.target ? mappingTargetById(search.target) : undefined
  const qa = profile === 'radnetz-berlin' ? tildaQaState(tags, radnetzBerlin) : undefined

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:px-8">
      {/* Phone: input, results, examples. Wide: input and examples on the left. */}
      <div className="lg:col-start-1 lg:row-start-1">
        <Section id="input" title="Eingabe">
          <div className="space-y-6">
            <TagInput tags={tags} onChange={setTags} />
            <SwitchField>
              <Label>Profil radnetz-berlin</Label>
              <Description>Pflichtangaben und die Regeln des Radnetz-Editors.</Description>
              <Switch
                name="profile"
                color="dark/zinc"
                checked={profile === 'radnetz-berlin'}
                onChange={(checked) => updateSearch({ profile: checked ? undefined : 'tilda-geo' })}
              />
            </SwitchField>
          </div>
        </Section>
      </div>

      <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <Section id="result" title="Ergebnis (processBikelanes)">
          <ResultCards
            tags={tags}
            results={results}
            side={result?._side}
            onSelect={(side) => updateSearch({ side })}
          />
        </Section>

        {result && (
          <Section id="target" title="Ändern in">
            <TargetPlan
              tags={tags}
              result={result}
              targetId={target?.id}
              onTarget={(id) => updateSearch({ target: id })}
              onApply={setTags}
            />
          </Section>
        )}

        {result && profile === 'radnetz-berlin' && (
          <Section
            id="requirements"
            title="Pflichtangaben"
            aside={
              qa && (
                <span className="flex items-center gap-2 text-sm/6 text-zinc-500">
                  QA <Badge color={QA_COLOR[qa.state]}>{qa.state}</Badge>
                </span>
              )
            }
          >
            <Requirements
              tags={tags}
              result={result}
              targetCategory={target?.categoryId}
              onSetTag={(key, value) => setTags({ ...tags, [key]: value })}
            />
          </Section>
        )}

        <Section id="validation" title="Validierung">
          <ValidationList tags={tags} profile={profile} onApply={setTags} />
        </Section>
      </div>

      <div className="lg:col-start-1 lg:row-start-2">
        <Section id="examples" title="Beispiele">
          <ExampleList current={tagsParam} profile={search.profile} />
        </Section>
      </div>
    </main>
  )
}
