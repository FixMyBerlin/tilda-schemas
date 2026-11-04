import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router'

const parseSearch = parseSearchWith(JSON.parse)
const stringifySearchDefault = stringifySearchWith(JSON.stringify)

// The router percent-encodes characters that are safe in a query value. Decoding them again
// keeps share links readable; `#`, `&`, `%` and `+` stay encoded.
const makeSearchPretty = (searchString: string) =>
  searchString
    .replaceAll('%22', '"')
    .replaceAll('%2C', ',')
    .replaceAll('%27', "'")
    .replaceAll('%28', '(')
    .replaceAll('%29', ')')
    .replaceAll('%3A', ':')
    .replaceAll('%3B', ';')
    .replaceAll('%5B', '[')
    .replaceAll('%5D', ']')
    .replaceAll('%7B', '{')
    .replaceAll('%7D', '}')
    .replaceAll('%2F', '/')
    // `tags=highway=cycleway`: URLSearchParams splits a pair at its first `=`, so a later one is safe.
    .replaceAll('%3D', '=')

export const routerSearch = {
  parse: parseSearch,
  stringify: (search: Record<string, unknown>) => makeSearchPretty(stringifySearchDefault(search)),
}
