import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import type { OsmTags } from '../types.ts'
import { RADNETZ_RULES } from './radnetz-rules.ts'
import { TILDA_GEO_RULES } from './tilda-geo-rules.ts'
import type { Finding, Rule, RuleContext, ValidationOptions } from './types.ts'

/** The whole catalogue: the todos of tilda-geo first, then the rules of the Radnetz profile */
export const RULES: readonly Rule[] = [...TILDA_GEO_RULES, ...RADNETZ_RULES]

export function ruleById(id: string): Rule | undefined {
  return RULES.find((rule) => rule.id === id)
}

/** The rules a run with these options uses, in the order of `RULES` */
export function activeRules(options: ValidationOptions = {}): Rule[] {
  const radnetz = options.profile === 'radnetz-berlin'
  return RULES.filter(
    (rule) =>
      (rule.source !== 'radnetz' || radnetz) &&
      (!options.only || options.only.includes(rule.id)) &&
      !options.skip?.includes(rule.id),
  )
}

function createContext(tags: OsmTags, options: ValidationOptions): RuleContext {
  const input: OsmTags = { ...tags }
  if (options.length !== undefined) input._length = options.length
  let bikelanes: ReturnType<typeof processBikelanes> | undefined
  return {
    tags,
    options,
    bikelanes: () => (bikelanes ??= processBikelanes(input)),
  }
}

/**
 * Checks the tags of one way against the rules. Pure: it needs no geometry and no neighbours, and does
 * not change `tags`. Findings come in the order of `RULES`.
 *
 * `tags` are the tags of a way as in OSM. A road with `cycleway:left=*` is checked on its sides too: the
 * `scope` of a finding says which part it is about.
 */
export function validateTags(tags: OsmTags, options: ValidationOptions = {}): Finding[] {
  const context = createContext(tags, options)
  const findings: Finding[] = []
  for (const rule of activeRules(options)) {
    for (const hit of rule.check(context)) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        source: rule.source,
        scope: hit.scope,
        keys: hit.keys,
        message: {
          code: hit.message?.code ?? rule.message.code,
          params: hit.message?.params ?? {},
        },
        fixes: hit.fixes ?? [],
      })
    }
  }
  return findings
}
