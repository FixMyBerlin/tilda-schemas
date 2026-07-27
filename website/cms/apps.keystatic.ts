import { collection, fields } from '@keystatic/core'

export const basePath = 'src/content/apps'

export const keystaticAppsConfig = collection({
  label: 'Apps',
  slugField: 'title',
  path: `${basePath}/*`,
  format: { data: 'yaml' },
  columns: ['title', 'url'],
  schema: {
    title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
    url: fields.url({ label: 'URL', validation: { isRequired: true } }),
    description: fields.text({ label: 'Description', multiline: true }),
  },
})
