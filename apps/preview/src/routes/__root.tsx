import { Outlet, createRootRoute, redirect } from '@tanstack/react-router'

const PACKAGES = [
  {
    name: '@tilda-geo/bicycle-infrastructure',
    dir: 'bicycle-infrastructure',
    version: __CORE_VERSION__,
  },
  {
    name: '@tilda-geo/bicycle-infrastructure-tagging',
    dir: 'bicycle-infrastructure-tagging',
    version: __TAGGING_VERSION__,
  },
]

const REPO = 'https://github.com/FixMyBerlin/tilda-schemas'

const RootLayout = () => (
  <div className="min-h-dvh">
    <header className="border-b border-zinc-950/10 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <h1 className="text-lg/7 font-semibold text-zinc-950">TILDA Radinfrastruktur · Viewer</h1>
          <p className="text-sm/6 text-zinc-500">
            Tags rein, Kategorie, Plan und Prüfungen raus. Alles kommt aus den Paketen.
          </p>
        </div>
        <ul className="flex flex-col gap-1 text-sm/6">
          {PACKAGES.map((pkg) => (
            <li key={pkg.name} className="flex flex-wrap items-baseline gap-x-2">
              <code className="font-mono text-xs text-zinc-950">{pkg.name}</code>
              <span className="text-zinc-500">v{pkg.version}</span>
              <a
                className="text-zinc-500 underline decoration-zinc-950/20 hover:text-zinc-950"
                href={`https://www.npmjs.com/package/${pkg.name}`}
              >
                npm
              </a>
              <a
                className="text-zinc-500 underline decoration-zinc-950/20 hover:text-zinc-950"
                href={`${REPO}/tree/main/packages/${pkg.dir}`}
              >
                GitHub
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
    <Outlet />
  </div>
)

export const Route = createRootRoute({
  // Canonical URLs without a trailing slash (pairs with `trailingSlash: 'never'`).
  beforeLoad: ({ location }) => {
    const { pathname, searchStr, hash } = location
    if (pathname.length <= 1 || !pathname.endsWith('/')) return
    const stripped = pathname.replace(/\/+$/, '') || '/'
    throw redirect({ href: `${stripped}${searchStr}${hash ? `#${hash}` : ''}`, replace: true })
  },
  component: RootLayout,
})
