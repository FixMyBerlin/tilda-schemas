import { Link } from '@tanstack/react-router'
import { TILDA_LABELS, categoryLabel } from '@tilda-geo/bicycle-infrastructure-tagging'
import clsx from 'clsx'
import { EXAMPLE_GROUPS } from './examples'
import type { Profile } from './search'

const expectedLabel = (id: string) => categoryLabel(id, TILDA_LABELS.de) ?? id

export function ExampleList({ current, profile }: { current: string; profile?: Profile }) {
  return (
    <nav aria-label="Beispiele" className="space-y-4">
      {EXAMPLE_GROUPS.map((group) => (
        <div key={group.id}>
          <h3 className="text-sm/6 font-semibold text-zinc-950">{group.label}</h3>
          <ul className="mt-1">
            {group.examples.map((example) => (
              <li key={example.tags}>
                <Link
                  to="/"
                  search={{ tags: example.tags, profile }}
                  className={clsx(
                    'block rounded-md px-2 py-0.5 text-sm/5 hover:bg-zinc-950/5',
                    current === example.tags ? 'bg-zinc-950/5 font-medium' : 'text-zinc-700',
                  )}
                >
                  {example.label}
                  <span
                    className="block truncate text-xs/5 text-zinc-500"
                    title={`erwartet: ${expectedLabel(example.expected)}`}
                  >
                    → {expectedLabel(example.expected)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
