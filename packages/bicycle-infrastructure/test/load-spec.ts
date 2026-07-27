/**
 * Load language-agnostic fixtures from schemas/ for conformance tests.
 * Not a package — schemas stay plain data folders.
 */
import categoryFixtures from '../../../schemas/bicycle-infrastructure-category/fixtures/categories.json'
import absenceFixtures from '../../../schemas/bicycle-infrastructure-category/fixtures/explicit-absence.json'
import onewayFixtures from '../../../schemas/bicycle-infrastructure-attributes/fixtures/oneway/oneway.json'
import surfaceFixtures from '../../../schemas/bicycle-infrastructure-attributes/fixtures/surface/surface.json'
import separationFixtures from '../../../schemas/bicycle-infrastructure-attributes/fixtures/separation/separation.json'
import smoothnessFixtures from '../../../schemas/bicycle-infrastructure-attributes/fixtures/smoothness/smoothness.json'
import transformationFixtures from '../../../schemas/bicycle-infrastructure-attributes/fixtures/transformation/transformation.json'

/** Which produced feature a case asserts against. Defaults to the `self` feature. */
export interface SpecSelect {
  side?: 'self' | 'left' | 'right'
  prefix?: string | null
}

export type SpecExpect = Record<string, unknown>

export interface SpecCase {
  name: string
  osm?: string
  input: Record<string, string>
  select?: SpecSelect
  expect?: SpecExpect
  expectFeatures?: Array<{ select: SpecSelect; expect: SpecExpect }>
}

export interface SpecGroup {
  key: string
  cases: SpecCase[]
}

export const SPEC: SpecGroup[] = [
  { key: 'category', cases: [...categoryFixtures, ...absenceFixtures] as unknown as SpecCase[] },
  // Attribute fixtures are draft until that schema is published.
  { key: 'oneway', cases: onewayFixtures as unknown as SpecCase[] },
  { key: 'surface', cases: surfaceFixtures as unknown as SpecCase[] },
  { key: 'separation', cases: separationFixtures as unknown as SpecCase[] },
  { key: 'smoothness', cases: smoothnessFixtures as unknown as SpecCase[] },
  { key: 'transformation', cases: transformationFixtures as unknown as SpecCase[] },
]

export const ALL_CASES: Array<SpecCase & { group: string }> = SPEC.flatMap((g) =>
  g.cases.map((c) => ({ group: g.key, ...c })),
)
