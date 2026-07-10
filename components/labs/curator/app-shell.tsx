'use client'

import type { ReactNode } from 'react'
import {
  LayoutDashboard, Landmark, Users, SquareKanban, Ticket, BookOpen, Settings,
  type LucideIcon,
} from 'lucide-react'
import OverviewModule from './modules/overview'

export type CuratorModule =
  | 'overview' | 'rooms' | 'personnel' | 'pipeline'
  | 'tickets' | 'engineering' | 'settings'

export const NAV_ITEMS: { id: CuratorModule; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'rooms', label: 'Rooms', icon: Landmark },
  { id: 'personnel', label: 'Personnel', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: SquareKanban },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'engineering', label: 'Engineering', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function AppShell({ children }: { children?: ReactNode }) {
  // Static until Task 8 wires module switching through the store.
  const activeModule: CuratorModule = 'overview'
  return (
    <div className="grid h-full grid-cols-[232px_1fr]">
      <aside className="flex flex-col bg-[var(--c-navy)] text-white/85">
        {/* mt-14 clears GalleryChrome's fixed "← Gallery" pill (top-4 left-4, z-50) */}
        <nav className="mt-14 flex-1 px-2" aria-label="Modules">
          <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
            Workspace
          </p>
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = item.id === activeModule
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-[13px] transition-colors duration-150 ${
                    active
                      ? 'bg-white font-medium text-[var(--c-navy)]'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>
        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-[13px] font-medium text-white">Aram Yeghiazaryan</p>
          <p className="text-[11px] text-white/50">Workspace Owner</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-6">
          <span aria-hidden className="h-4 w-4 rounded-[3px] bg-[var(--c-blue)]" />
          <span className="text-[14px] font-semibold tracking-tight">Curator</span>
          <span className="font-[family-name:var(--font-data)] text-[10px] text-[var(--c-text-soft)]">v4.2.1</span>
          <span aria-hidden className="h-4 w-px bg-[var(--c-border)]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
            Portfolio Operations Platform
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children ?? <OverviewModule />}</main>
      </div>
    </div>
  )
}
