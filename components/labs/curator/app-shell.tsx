'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Landmark, Users, SquareKanban, Ticket, BookOpen, Settings, ChevronsUpDown, Menu,
  type LucideIcon,
} from 'lucide-react'
import { ModuleHost } from './module-host'
import { ToastViewport } from './ui/toast'
import { useEscCapture } from './use-esc-capture'
import { NpsSurvey } from './nps-survey'
import { useCuratorStore, type CuratorModule } from './store'

export const NAV_ITEMS: { id: CuratorModule; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'rooms', label: 'Rooms', icon: Landmark },
  { id: 'personnel', label: 'Personnel', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: SquareKanban },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'engineering', label: 'Engineering', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function AppShell({ email, children }: { email: string; children?: ReactNode }) {
  const activeModule: CuratorModule = useCuratorStore((s) => s.module)
  const setModule = useCuratorStore((s) => s.setModule)
  const sidebarOpen = useCuratorStore((s) => s.sidebarOpen)
  const setSidebarOpen = useCuratorStore((s) => s.setSidebarOpen)
  const drawerPanelRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const drawerWasOpenRef = useRef(false)

  useEffect(() => {
    const label = NAV_ITEMS.find((item) => item.id === activeModule)?.label ?? ''
    document.title = `${label} · Curator`
  }, [activeModule])

  // The drawer dialog sits before the hamburger in DOM order, so without this
  // a keyboard user tabbing from the hamburger would land in <main> behind the
  // "modal". Focus the panel on open; restore focus to the trigger on every
  // close path (nav select, backdrop pointerdown, Escape) — all of which
  // funnel through sidebarOpen.
  useEffect(() => {
    if (sidebarOpen) {
      drawerPanelRef.current?.focus()
    } else if (drawerWasOpenRef.current) {
      hamburgerRef.current?.focus()
    }
    drawerWasOpenRef.current = sidebarOpen
  }, [sidebarOpen])

  const closeSidebar = () => setSidebarOpen(false)
  useEscCapture(sidebarOpen, closeSidebar)

  function selectMobileModule(id: CuratorModule): void {
    setModule(id)
    setSidebarOpen(false)
  }

  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)] grid-cols-1 lg:grid-cols-[232px_1fr]">
      <aside className="hidden min-h-0 flex-col overflow-y-auto bg-[var(--c-navy)] text-white/85 lg:flex">
        <SidebarContent email={email} activeModule={activeModule} onSelect={setModule} />
      </aside>
      {sidebarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-50 flex bg-[rgba(12,35,64,0.4)] lg:hidden"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeSidebar()
          }}
        >
          <div
            ref={drawerPanelRef}
            tabIndex={-1}
            className="flex h-full w-[264px] max-w-[80vw] flex-col bg-[var(--c-navy)] text-white/85 outline-none"
          >
            <SidebarContent email={email} activeModule={activeModule} onSelect={selectMobileModule} />
          </div>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-col">
        {/* mt-14 clears GalleryChrome's fixed "← Gallery" pill (top-4 left-4 z-50) on
            mobile, where this header starts flush with the viewport's top-left corner
            (same collision the sidebar nav below handles the same way); the desktop
            aside already sits clear of the pill horizontally, so lg:mt-0 undoes it. */}
        <header className="mt-14 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-6 lg:mt-0">
          <button
            ref={hamburgerRef}
            type="button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-[6px] text-[var(--c-text)] transition-colors duration-150 hover:bg-[var(--c-hover)] lg:hidden"
          >
            <Menu aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <span aria-hidden className="h-4 w-4 rounded-[3px] bg-[var(--c-blue)]" />
          <span className="text-[14px] font-semibold tracking-tight">Curator</span>
          <span className="font-[family-name:var(--font-data)] text-[10px] text-[var(--c-text-soft)]">v4.2.1</span>
          <span aria-hidden className="h-4 w-px bg-[var(--c-border)]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
            Portfolio Operations Platform
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children ?? <ModuleHost />}</main>
        <ToastViewport />
        <NpsSurvey />
      </div>
    </div>
  )
}

function SidebarContent({
  email, activeModule, onSelect,
}: { email: string; activeModule: CuratorModule; onSelect: (id: CuratorModule) => void }) {
  return (
    <>
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
                onClick={() => onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full touch-manipulation items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-[13px] transition-colors duration-150 ${
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
      <UserMenu email={email} />
    </>
  )
}

function UserMenu({ email }: { email: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const close = () => setOpen(false)
  useEscCapture(open, close)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  async function signOut(): Promise<void> {
    await fetch('/api/labs/curator/session', { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div ref={rootRef} className="relative border-t border-white/10 px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-[6px] py-1 text-left transition-colors duration-150 hover:bg-white/10"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-medium text-white">
          AY
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white">Aram Yeghiazaryan</span>
          <span className="block truncate text-[11px] text-white/50">Workspace Owner</span>
        </span>
        <ChevronsUpDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-white/50" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute bottom-full left-4 right-4 mb-2 rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-1 text-[var(--c-text)]">
          <p className="truncate px-2 py-1.5 font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">
            {email}
          </p>
          <div className="my-1 h-px bg-[var(--c-border)]" />
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full rounded-[4px] px-2 py-1.5 text-left text-[13px] text-[var(--c-text)] transition-colors duration-150 hover:bg-[var(--c-hover)]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
