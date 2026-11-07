import type React from 'react'

/** A card with a heading (Tailwind Plus "Card with header"). */
export function Section({
  id,
  title,
  aside,
  children,
}: {
  id: string
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="divide-y divide-zinc-950/5 rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-5">
        <h2 id={`${id}-title`} className="text-base/7 font-semibold text-zinc-950">
          {title}
        </h2>
        {aside}
      </header>
      <div className="px-4 py-3 sm:px-5">{children}</div>
    </section>
  )
}

/** `key=value` in a monospace chip; long values wrap. */
export function Tag({ k, v }: { k: string; v?: string }) {
  return (
    <code className="rounded bg-zinc-950/5 px-1 py-0.5 font-mono text-xs break-all text-zinc-950">
      {k}
      {v !== undefined && `=${v}`}
    </code>
  )
}
