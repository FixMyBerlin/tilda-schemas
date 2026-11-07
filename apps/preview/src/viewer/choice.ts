import type { MappingChoice } from '@tilda-geo/bicycle-infrastructure-tagging'
import type { ViewerSearch } from './search'

/** The search params that make up a mapping choice */
export type ChoiceSearch = Pick<ViewerSearch, 'kind' | 'position' | 'sign' | 'lines' | 'lifecycle'>

/** The choice in the URL, or `undefined` while no kind is picked */
export function choiceFromSearch(search: ChoiceSearch): MappingChoice | undefined {
  if (!search.kind) return undefined
  return {
    kind: search.kind,
    ...(search.position ? { position: search.position } : {}),
    ...(search.sign ? { sign: search.sign } : {}),
    ...(search.lines ? { lines: search.lines } : {}),
    ...(search.lifecycle ? { lifecycle: search.lifecycle } : {}),
  }
}

/** All choice params, each `undefined` when not set, so a partial update clears the old ones */
export function searchFromChoice(
  choice: MappingChoice | undefined,
  defaultPosition?: MappingChoice['position'],
): ChoiceSearch {
  return {
    kind: choice?.kind,
    // the default position stays out of the URL
    position: choice?.position === defaultPosition ? undefined : choice?.position,
    sign: choice?.sign,
    lines: choice?.lines,
    lifecycle: choice?.lifecycle,
  }
}
