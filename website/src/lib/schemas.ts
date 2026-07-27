import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

export type SchemaMeta = {
  name: string
  title: string
  status: string
  version: string
  description?: string
  schema?: string
  fixtures?: string
  changelog?: string
}

const schemasRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../schemas')

/** Build-time list of schema folders via metadata.yaml (not Keystatic). */
export function loadSchemaMetas(): SchemaMeta[] {
  if (!fs.existsSync(schemasRoot)) return []
  return fs
    .readdirSync(schemasRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const metaPath = path.join(schemasRoot, d.name, 'metadata.yaml')
      if (!fs.existsSync(metaPath)) return null
      const raw = parseYaml(fs.readFileSync(metaPath, 'utf8')) as SchemaMeta
      return { ...raw, name: raw.name ?? d.name }
    })
    .filter((m): m is SchemaMeta => m !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}
