/**
 * Port of osm2pgsql.split_unit + topics/helper/parse_length.lua + topics/helper/parse_width.lua
 * (tilda-geo, state of 2026-11-04). One parser for every `width`, `buffer` and other length value.
 */

/**
 * Decimal commas in `width`. These are the values used more than 10 times on highways in Germany
 * (Geofabrik extract 2026-10). Every other comma value stays unreadable (returns `undefined`),
 * so it gets fixed in OSM. Same table as `decimal_comma_values` in parse_length.lua.
 */
const DECIMAL_COMMA_VALUES: Record<string, string> = {
  '0,3': '0.3',
  '0,5': '0.5',
  '0,6': '0.6',
  '1,5': '1.5',
  '2,2': '2.2',
  '2,5': '2.5',
  '2,50': '2.50',
}

/** `osm2pgsql.split_unit(str, 'm')`: `^(-?[0-9.]+) ?(%a*)$`, no unit means meters. */
function splitUnit(str: string): [number, string] | null {
  const m = str.match(/^(-?[0-9.]+) ?([A-Za-z]*)$/)
  if (!m) return null
  const val = Number(m[1])
  if (Number.isNaN(val)) return null
  return [val === 0 ? 0 : val, m[2] || 'm']
}

/**
 * Normalize a length to meters. Units `cm`, `m` and `km` are converted, every other unit
 * (`mm`, `ft`, `in`, `mi`, ...) is `undefined`, like in LUA. A negative length is `undefined`;
 * `0` is kept (`buffer=0` means no buffer). Use `parseWidth` when `0` makes no sense.
 */
export function parseLength(length: string | number | undefined | null): number | undefined {
  if (length == null) return undefined
  const key = String(length)
  const parsed = splitUnit(DECIMAL_COMMA_VALUES[key] ?? key)
  if (!parsed) return undefined
  const [val, unit] = parsed
  if (val < 0) return undefined
  if (unit === 'cm') return val / 100
  if (unit === 'm') return val
  if (unit === 'km') return val * 1000
  return undefined
}

/** Like `parseLength` for the width of a road or lane, where `0` can only be a mapping error. */
export function parseWidth(width: string | number | undefined | null): number | undefined {
  const value = parseLength(width)
  return value !== undefined && value > 0 ? value : undefined
}
