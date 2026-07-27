/** Port of topics/helper/sanitize_traffic_sign.lua */
import { sanitizeString } from './sanitize-string.ts'

function stripWhitespaces(trafficSign: string): string {
  return trafficSign.replace(/, /g, ',').replace(/; /g, ';')
}

function sanitizeValue(value: string): string | undefined {
  return sanitizeString(stripWhitespaces(value))
}

export function sanitizeTrafficSign(trafficSign: string | undefined | null): string | undefined {
  if (trafficSign == null) return undefined
  if (trafficSign === 'no' || trafficSign === 'none') return 'none'

  // Correct tagging: starts with `DE:` followed by a non-space.
  if (/^DE:\S/.test(trafficSign)) {
    return sanitizeValue(trafficSign)
  }

  // Ordered substitutions (LUA used a table; order is not guaranteed there, but these
  // patterns are mutually exclusive on the anchored start, so order is irrelevant).
  const substitutions: Array<[RegExp, string]> = [
    [/^DE: /, 'DE:'],
    [/^DE\./, 'DE:'],
    [/^D:/, 'DE:'],
    [/^D\./, 'DE:'],
    [/^de:/, 'DE:'],
    [/^DE1/, 'DE:1'],
    [/^DE2/, 'DE:2'],
    [/^2/, 'DE:2'],
    [/^1/, 'DE:1'],
  ]
  for (const [pattern, replacement] of substitutions) {
    if (pattern.test(trafficSign)) {
      return sanitizeValue(trafficSign.replace(pattern, replacement))
    }
  }

  // Free text traffic sign, cleaned up.
  return sanitizeString(trafficSign)
}
