/** Port of topics/helper/contains_substring.lua + osm2pgsql has_prefix/has_suffix. */

export function containsSubstring(
  str: string | undefined | null,
  subStr: string | undefined | null,
): boolean {
  if (str == null || subStr == null) return false
  return str.includes(subStr)
}

/** osm2pgsql.has_prefix — returns false for nullish input (LUA returns nil ≈ falsy). */
export function hasPrefix(str: string | undefined | null, prefix: string): boolean {
  if (str == null) return false
  return str.startsWith(prefix)
}

/** osm2pgsql.has_suffix — empty suffix is always true; nullish input is false. */
export function hasSuffix(str: string | undefined | null, suffix: string): boolean {
  if (str == null) return false
  if (suffix === '') return true
  return str.endsWith(suffix)
}

/** Whether any key in `tags` starts with `prefix` (has_tag_with_prefix.lua). */
export function hasTagWithPrefix(
  tags: Record<string, unknown> | undefined,
  prefix: string | undefined,
): boolean {
  if (tags == null || prefix == null) return false
  for (const key of Object.keys(tags)) {
    if (key.startsWith(prefix)) return true
  }
  return false
}
