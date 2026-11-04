import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { routerSearch } from './routerSearch'
import { routeTree } from './routeTree.gen'

// Vite `base` (e.g. `/tilda-schemas/` on GitHub Pages) becomes the router basepath.
const basepath = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

const router = createRouter({
  routeTree,
  basepath,
  trailingSlash: 'never',
  // Readable share links (`?tags=highway=cycleway;bicycle=designated`), see ./routerSearch.
  parseSearch: routerSearch.parse,
  stringifySearch: routerSearch.stringify,
})

declare module '@tanstack/react-router' {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation needs an interface
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
