'use client'

import type { ReactNode } from 'react'

export type CuratorModule =
  | 'overview' | 'rooms' | 'personnel' | 'pipeline'
  | 'tickets' | 'engineering' | 'settings'

export const NAV_ITEMS: { id: CuratorModule; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'personnel', label: 'Personnel' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'settings', label: 'Settings' },
]

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="grid h-full grid-cols-[232px_1fr]">
      <aside className="flex flex-col bg-[var(--c-navy)] text-white/85">
        <div className="flex items-center gap-2 px-4 py-4">
          <span aria-hidden className="h-4 w-4 rounded-[3px] bg-[var(--c-blue)]" />
          <span className="text-[14px] font-semibold tracking-tight text-white">Curator</span>
          <span className="ml-auto font-[family-name:var(--font-data)] text-[10px] text-white/40">v4.2.1</span>
        </div>
        <nav className="mt-2 flex-1 px-2" aria-label="Modules">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="block w-full rounded-[6px] px-3 py-2 text-left text-[13px] text-white/75 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-[13px] font-medium text-white">Aram Yeghiazaryan</p>
          <p className="text-[11px] text-white/50">Workspace Owner</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-[var(--c-border)] bg-[var(--c-surface)] px-6">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
            Portfolio Operations Platform
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
