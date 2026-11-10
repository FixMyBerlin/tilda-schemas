import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { processBikelanes } from '@tilda-geo/bicycle-infrastructure'
import { type ExampleGroup, parseExampleTables } from './exampleTable.ts'
import { parseTagsParam } from './tagsParam.ts'

const markdown = readFileSync(
  new URL('../../../../docs/viewer-examples.md', import.meta.url),
  'utf8',
)
const groups = parseExampleTables(markdown)
const examples = groups.flatMap((group) => group.examples)

describe('examples from docs/viewer-examples.md', () => {
  it('reads the three groups with German titles', () => {
    expect(groups.map((group) => group.label)).toEqual([
      'Geh- und Radwege: gemeinsam, getrennt, zwei Linien',
      'Eigene Linie: Radweg',
      'Tags an der Straße (ein Ergebnis je Seite)',
    ])
    expect(examples.length).toBeGreaterThan(25)
  })

  it.each(examples)('$label: the viewer link has the tags of the row', (example) => {
    expect(example.linkTags).toBe(example.tags)
  })

  it.each(examples)('$label: the package gives the expected category', (example) => {
    const categories = processBikelanes(parseTagsParam(example.tags)).map((r) => r.category)
    expect(categories).toContain(example.expected)
  })
})

describe('viewer links in an example table', () => {
  const tableWithLink = (link: string) =>
    [
      '## Group',
      '',
      '| Viewer | Tags | Category |',
      '| --- | --- | --- |',
      `| [x](${link}) | \`highway=cycleway\` | \`cycleway\` |`,
    ].join('\n')

  it('a relative link gives the tags of the link', () => {
    const groups: ExampleGroup[] = parseExampleTables(tableWithLink('?tags=highway=cycleway'))
    expect(groups[0]!.examples[0]!.linkTags).toBe('highway=cycleway')
  })

  it('a broken link does not throw and leaves linkTags out', () => {
    let groups: ExampleGroup[] = []
    expect(() => {
      groups = parseExampleTables(tableWithLink('http://[broken'))
    }).not.toThrow()
    expect(groups[0]!.examples[0]).toMatchObject({ tags: 'highway=cycleway', expected: 'cycleway' })
    expect(groups[0]!.examples[0]!.linkTags).toBeUndefined()
  })
})
