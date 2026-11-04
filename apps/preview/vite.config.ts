import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = dirname(fileURLToPath(import.meta.url))
const coreDir = resolve(rootDir, '../../packages/bicycle-infrastructure')
const taggingDir = resolve(rootDir, '../../packages/bicycle-infrastructure-tagging')

const packageVersion = (dir: string) =>
  (JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as { version: string }).version

// Project Pages live at /<repo>/; local `vite` / `vite preview` stay at `/`.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    // The viewer runs against the package source, so it needs no package build and hot reloads.
    // Keep in sync with `paths` in tsconfig.json. The longer subpaths come first.
    alias: [
      {
        find: /^@tilda-geo\/bicycle-infrastructure-tagging\/profiles\/radnetz-berlin$/,
        replacement: resolve(taggingDir, 'src/profiles/radnetz-berlin.ts'),
      },
      {
        find: /^@tilda-geo\/bicycle-infrastructure-tagging$/,
        replacement: resolve(taggingDir, 'src/index.ts'),
      },
      {
        find: /^@tilda-geo\/bicycle-infrastructure$/,
        replacement: resolve(coreDir, 'src/index.ts'),
      },
    ],
  },
  define: {
    __CORE_VERSION__: JSON.stringify(packageVersion(coreDir)),
    __TAGGING_VERSION__: JSON.stringify(packageVersion(taggingDir)),
  },
  server: {
    // Honor the PORT assigned by the preview tooling / CI; fall back for local dev.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
