import { collection, fields } from '@keystatic/core'

export const basePath = 'src/content/research'

export const keystaticResearchConfig = collection({
  label: 'Research',
  slugField: 'title',
  path: `${basePath}/*`,
  format: { data: 'yaml' },
  columns: ['title', 'url'],
  schema: {
    title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
    url: fields.url({ label: 'URL' }),
    description: fields.text({ label: 'Description', multiline: true }),
  },
})
