import type { OsmTags } from '@tilda-geo/bicycle-infrastructure'
import {
  MESSAGES,
  RULES,
  activeRules,
  applyTagFix,
  renderMessage,
  validateTags,
  type Finding,
} from '@tilda-geo/bicycle-infrastructure-tagging'
import clsx from 'clsx'
import { Badge } from '../components/catalyst/badge'
import { Button } from '../components/catalyst/button'
import { SEVERITY_COLOR, SEVERITY_LABEL } from './copy'
import type { Profile } from './search'

type Props = {
  tags: OsmTags
  profile: Profile
  onApply: (tags: OsmTags) => void
}

export function ValidationList({ tags, profile, onApply }: Props) {
  const findings = validateTags(tags, { profile })
  const active = new Set(activeRules({ profile }).map((rule) => rule.id))
  const byRule = new Map<string, Finding[]>()
  for (const finding of findings) {
    byRule.set(finding.ruleId, [...(byRule.get(finding.ruleId) ?? []), finding])
  }
  // Triggered rules first, then the rest in the order of `RULES`.
  const rules = [...RULES].sort((a, b) => Number(byRule.has(b.id)) - Number(byRule.has(a.id)))

  return (
    <div>
      <p className="text-sm/6 text-zinc-500">
        {findings.length
          ? `${byRule.size} von ${RULES.length} Regeln lösen aus.`
          : `Keine der ${RULES.length} Regeln löst aus.`}
      </p>
      <ul className="mt-3 space-y-2" data-testid="rules">
        {rules.map((rule) => {
          const hits = byRule.get(rule.id) ?? []
          const triggered = hits.length > 0
          return (
            <li
              key={rule.id}
              data-testid={triggered ? 'rule-triggered' : 'rule'}
              data-rule={rule.id}
              className={clsx(
                'rounded-lg p-3 ring-1',
                triggered ? 'bg-white ring-zinc-950/15' : 'bg-zinc-50 opacity-60 ring-zinc-950/5',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm/6 font-medium break-all text-zinc-950">
                  {rule.id}
                </span>
                <Badge color={triggered ? SEVERITY_COLOR[rule.severity] : 'zinc'}>
                  {SEVERITY_LABEL[rule.severity]}
                </Badge>
                <Badge>{rule.source}</Badge>
                {!active.has(rule.id) && <Badge>nur Profil radnetz-berlin</Badge>}
              </div>
              {!triggered && (
                <p className="mt-1 text-sm/5 text-zinc-600">{MESSAGES.de[rule.message.code]}</p>
              )}
              {hits.map((finding, index) => (
                <div key={`${finding.scope}-${index}`} className="mt-2">
                  <p className="text-sm/5 text-zinc-950">{renderMessage(finding.message, 'de')}</p>
                  <p className="mt-0.5 font-mono text-xs/5 break-all text-zinc-500">
                    {finding.scope}: {finding.keys.join(', ')}
                  </p>
                  {!!finding.fixes.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {finding.fixes.map((fix) => (
                        <Button
                          key={fix.message.code + JSON.stringify(fix.message.params)}
                          outline
                          onClick={() => onApply(applyTagFix(tags, fix))}
                        >
                          {renderMessage(fix.message, 'de')}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
