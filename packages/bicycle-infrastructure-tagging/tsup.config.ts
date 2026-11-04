import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    validation: 'src/validations/index.ts',
    'profiles/radnetz-berlin': 'src/profiles/radnetz-berlin.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: false,
})
