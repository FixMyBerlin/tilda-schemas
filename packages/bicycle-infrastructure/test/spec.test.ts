/**
 * Conformance: the library must satisfy every case in the language-agnostic
 * schemas/ fixtures. This is the primary correctness gate.
 */
import { expect, test, describe } from 'bun:test'
import { ALL_CASES, type SpecSelect, type SpecExpect } from './load-spec.ts'
import { processBikelanes, type BikelaneResult } from '../src/index.ts'

function selectFeature(features: BikelaneResult[], select: SpecSelect = {}): BikelaneResult | undefined {
  const side = select.side ?? 'self'
  return features.find((f) => {
    if (f._side !== side) return false
    if (select.prefix !== undefined) return (f._prefix ?? null) === (select.prefix ?? null)
    return true
  })
}

/** Normalized equality: undefined and null align. */
function eq(a: unknown, b: unknown): boolean {
  const na = a === undefined ? null : a
  const nb = b === undefined ? null : b
  if (typeof na === 'number' || typeof nb === 'number') return Math.abs(Number(na) - Number(nb)) < 1e-6
  return na === nb
}

function assertFeature(feature: BikelaneResult | undefined, expect_: SpecExpect, label: string) {
  expect(feature, `${label}: no feature matched the selector`).toBeDefined()
  for (const [key, want] of Object.entries(expect_)) {
    const got = (feature as unknown as Record<string, unknown>)[key]
    expect(eq(got, want), `${label}: ${key} expected ${JSON.stringify(want)} but got ${JSON.stringify(got)}`).toBe(true)
  }
}

const byGroup = new Map<string, typeof ALL_CASES>()
for (const c of ALL_CASES) {
  const list = byGroup.get(c.group) ?? []
  list.push(c)
  byGroup.set(c.group, list)
}

for (const [group, cases] of byGroup) {
  describe(`spec: ${group}`, () => {
    for (const c of cases) {
      test(c.name, () => {
        const features = processBikelanes({ ...c.input })
        if (c.expectFeatures) {
          for (const ef of c.expectFeatures) {
            assertFeature(selectFeature(features, ef.select), ef.expect, c.name)
          }
        } else {
          assertFeature(selectFeature(features, c.select), c.expect ?? {}, c.name)
        }
      })
    }
  })
}
