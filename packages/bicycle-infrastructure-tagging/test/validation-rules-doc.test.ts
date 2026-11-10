import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { END, START, validationRulesDoc } from '../scripts/validation-rules-doc.ts'

/**
 * The generated table is formatted by oxfmt after `validation-rules-doc`, so the file can differ in
 * whitespace and in the width of the separator lines. Both sides are normalized the same way: each
 * line is trimmed, runs of spaces collapse, spaces around `|` go, runs of `-` become one `-`, and
 * empty lines are dropped.
 */
const normalize = (text: string) =>
  text
    .split('\n')
    .map((line) =>
      line
        .replace(/\s+/g, ' ')
        .replace(/\s*\|\s*/g, '|')
        .replace(/-{2,}/g, '-')
        .trim(),
    )
    .filter((line) => line !== '')

describe('docs/validation-rules.md', () => {
  it('lists every rule (bun run validation-rules-doc)', () => {
    const doc = readFileSync(new URL('../../../docs/validation-rules.md', import.meta.url), 'utf8')
    const from = doc.indexOf(START)
    const to = doc.indexOf(END)
    expect(from, 'start marker').toBeGreaterThanOrEqual(0)
    expect(to, 'end marker').toBeGreaterThan(from)

    const inFile = doc.slice(from + START.length, to)
    expect(normalize(inFile)).toEqual(normalize(validationRulesDoc()))
  })
})
