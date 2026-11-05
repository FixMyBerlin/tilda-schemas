/**
 * The example links of the start page, read from the tables of docs/viewer-examples.md. Every
 * `## ` heading with a table is a group; a row gives the German label (link text of the column
 * "Viewer"), the tags (the code span of the column "Tags") and the expected category (the first code
 * span of the last column, `right: \`cyclewayOnHighway_advisory\`` → `cyclewayOnHighway_advisory`).
 */
export type Example = {
  label: string
  tags: string
  expected: string
  /** The tags of the row's viewer link; the test checks that they match `tags` */
  linkTags?: string
}

export type ExampleGroup = {
  id: string
  label: string
  examples: Example[]
}

/** German group titles by the start of the English heading; other headings are shown as they are */
const GROUP_LABELS: [prefix: string, label: string][] = [
  ['Foot and cycle paths', 'Geh- und Radwege: gemeinsam, getrennt, zwei Linien'],
  ['Cycleway on a line of its own', 'Eigene Linie: Radweg'],
  ['Tags on the road', 'Tags an der Straße (ein Ergebnis je Seite)'],
]

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())

const codeSpans = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]!)

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function parseExampleTables(markdown: string): ExampleGroup[] {
  const groups: ExampleGroup[] = []
  let heading: string | undefined
  let columns: string[] | undefined

  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      heading = line.slice(3).trim()
      columns = undefined
      continue
    }
    if (!heading || !line.trim().startsWith('|')) {
      columns = undefined
      continue
    }
    const row = cells(line)
    if (!columns) {
      columns = row
      continue
    }
    if (row.every((cell) => /^:?-+:?$/.test(cell))) continue

    const viewer = row[columns.indexOf('Viewer')]
    const tagsCell = row[columns.indexOf('Tags')]
    const last = row[row.length - 1]
    if (viewer === undefined || tagsCell === undefined || last === undefined) continue
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(viewer)
    const tags = codeSpans(tagsCell)[0]
    const expected = codeSpans(last)[0]
    if (!tags || !expected) continue

    const plainHeading = heading.replace(/\s*\(.*\)\s*$/, '').replace(/`/g, '')
    let group = groups.find((g) => g.id === slug(plainHeading))
    if (!group) {
      const label =
        GROUP_LABELS.find(([prefix]) => plainHeading.startsWith(prefix))?.[1] ?? plainHeading
      group = { id: slug(plainHeading), label, examples: [] }
      groups.push(group)
    }
    const linkTags = link ? new URL(link[2]!).searchParams.get('tags') : null
    group.examples.push({
      label: link?.[1] ?? viewer,
      tags,
      expected,
      ...(linkTags ? { linkTags } : {}),
    })
  }
  return groups
}
