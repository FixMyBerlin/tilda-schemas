/** Port of topics/helper/sanitize_string.lua */
export function sanitizeString(value: string | undefined | null): string | undefined {
  if (value == null) return undefined
  // Remove ASCII control chars (keep newlines/tabs). The control characters are the point here.
  // oxlint-disable-next-line eslint/no-control-regex
  let out = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  // Neutralize HTML/XML-like tags: <...> -> (...)
  out = out.replace(/<\s*\/?\s*[A-Za-z][^>]*?>/g, (tag) =>
    tag.replace(/</g, '(').replace(/>/g, ')'),
  )
  return out
}
