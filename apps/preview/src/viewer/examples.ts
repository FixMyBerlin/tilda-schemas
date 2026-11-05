import markdown from '../../../../docs/viewer-examples.md?raw'
import { parseExampleTables } from './exampleTable'

export type { Example, ExampleGroup } from './exampleTable'

/** The cases of docs/viewer-examples.md, as links on the start page */
export const EXAMPLE_GROUPS = parseExampleTables(markdown)
