import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  processBikelanes,
  type BikelaneResult,
  type OsmTags,
} from '@tilda-geo/bicycle-infrastructure'
import {
  mappingTargetById,
  qaStateLabel,
  tildaQaState,
} from '@tilda-geo/bicycle-infrastructure-tagging'
import { radnetzBerlin } from '@tilda-geo/bicycle-infrastructure-tagging/profiles/radnetz-berlin'
import { tildaGeo } from '@tilda-geo/bicycle-infrastructure-tagging/profiles/tilda-geo'
import { Badge } from '../components/catalyst/badge'
import { Description, Fieldset, Label, Legend } from '../components/catalyst/fieldset'
import { Radio, RadioField, RadioGroup } from '../components/catalyst/radio'
import { QA_COLOR } from '../viewer/copy'
import { ExampleList } from '../viewer/ExampleList'
import { Requirements } from '../viewer/Requirements'
import { ResultCards } from '../viewer/ResultCards'
import {
  DEFAULT_PROFILE,
  PROFILES,
  viewerSearchSchema,
  type Profile,
  type ViewerSearch,
} from '../viewer/search'
import { Section } from '../viewer/Section'
import { TagInput } from '../viewer/TagInput'
import { parseTagsParam, serializeTagsParam } from '../viewer/tagsParam'
import { TargetPlan } from '../viewer/TargetPlan'
import { ValidationList } from '../viewer/ValidationList'

export const Route = createFileRoute('/')({
  validateSearch: viewerSearchSchema,
  component: Viewer,
})

/** Which attributes are required and which editor rules apply */
const PROFILE_COPY: Record<Profile, { label: string; description: string }> = {
  'radnetz-berlin': {
    label: 'Radnetz Berlin',
    description: 'Pflichtangaben des Radnetz-Datensatzes und die Regeln des Radnetz-Editors.',
  },
  'tilda-geo': {
    label: 'TILDA',
    description: 'Nur das, was TILDA selbst liest.',
  },
}

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
  const requirementsProfile = profile === 'radnetz-berlin' ? radnetzBerlin : tildaGeo
  const qa = tildaQaState(tags, requirementsProfile)

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:px-8">
      {/* Phone: input, results, examples. Wide: input and examples on the left. */}
      <div className="lg:col-start-1 lg:row-start-1">
        <Section id="input" title="Eingabe">
          <div className="space-y-6">
            <TagInput tags={tags} onChange={setTags} />
            <Fieldset>
              <Legend>Profil</Legend>
              <RadioGroup
                name="profile"
                value={profile}
                onChange={(value: string) => {
                  const next = PROFILES.find((id) => id === value)
                  updateSearch({ profile: next === DEFAULT_PROFILE ? undefined : next })
                }}
              >
                {PROFILES.map((id) => (
                  <RadioField key={id}>
                    <Radio value={id} color="dark/zinc" />
                    <Label>{PROFILE_COPY[id].label}</Label>
                    <Description>{PROFILE_COPY[id].description}</Description>
                  </RadioField>
                ))}
              </RadioGroup>
            </Fieldset>
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
            onSetTag={(key, value) => setTags({ ...tags, [key]: value })}
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

        {result && (
          <Section
            id="requirements"
            title="Pflichtangaben"
            aside={
              qa && (
                <span className="flex items-center gap-2 text-sm/6 text-zinc-500">
                  QA{' '}
                  <Badge color={QA_COLOR[qa.state]} title={qa.state}>
                    {qaStateLabel(qa.state, 'de')}
                  </Badge>
                </span>
              )
            }
          >
            <Requirements
              tags={tags}
              result={result}
              profile={requirementsProfile}
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
