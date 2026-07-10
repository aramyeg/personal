import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getDealCards, type PipelineColumn } from './adapters'

export type CuratorModule =
  | 'overview' | 'rooms' | 'personnel' | 'pipeline' | 'tickets' | 'engineering' | 'settings'
export const MODULE_IDS: CuratorModule[] = [
  'overview', 'rooms', 'personnel', 'pipeline', 'tickets', 'engineering', 'settings',
]
export type Density = 'comfortable' | 'compact'
export type Toast = { id: number; title: string; description?: string }
export type PipelineState = Record<PipelineColumn, string[]>
export type Preferences = { showSpecChips: boolean; reduceMotion: boolean; showSampleData: boolean }

export const PIPELINE_COLUMNS: { id: PipelineColumn; label: string }[] = [
  { id: 'sourced', label: 'Sourced' },
  { id: 'in-review', label: 'In Review' },
  { id: 'offer', label: 'Offer' },
  { id: 'closed-won', label: 'Closed Won' },
]

export function defaultPipeline(): PipelineState {
  const deals = getDealCards()
  const state: PipelineState = { sourced: [], 'in-review': [], offer: [], 'closed-won': [] }
  for (const deal of deals) state[deal.defaultColumn].push(deal.id)
  return state
}

export function defaultPreferences(): Preferences {
  return { showSpecChips: true, reduceMotion: false, showSampleData: true }
}

let toastSeq = 0

type CuratorState = {
  module: CuratorModule
  moduleVisits: number
  toasts: Toast[]
  density: Density
  sidebarOpen: boolean
  preferences: Preferences
  pipeline: PipelineState
  npsDone: boolean
  setModule(m: CuratorModule): void
  pushToast(t: Omit<Toast, 'id'>): void
  dismissToast(id: number): void
  setDensity(d: Density): void
  setSidebarOpen(open: boolean): void
  setPreference(key: keyof Preferences, value: boolean): void
  movePipelineCard(cardId: string, to: PipelineColumn, toIndex: number): void
  markNpsDone(): void
}

export type PersistedCuratorState = {
  density: Density
  preferences: Preferences
  pipeline: PipelineState
  npsDone: boolean
}

/**
 * Pure migration for the persisted slice, exported so it's directly
 * testable without going through localStorage/zustand rehydration.
 * v1 stored `notifications` instead of `preferences` — any version below the
 * current one is normalized into the current shape, dropping `notifications`
 * and injecting preference defaults while carrying density/pipeline/npsDone
 * forward untouched.
 */
export function migratePersisted(state: unknown, version: number): PersistedCuratorState {
  const s = (state ?? {}) as Partial<PersistedCuratorState> & { notifications?: unknown }
  if (version < 2) {
    return {
      density: s.density ?? 'comfortable',
      preferences: defaultPreferences(),
      pipeline: s.pipeline ?? defaultPipeline(),
      npsDone: Boolean(s.npsDone),
    }
  }
  return {
    density: s.density ?? 'comfortable',
    preferences: s.preferences ?? defaultPreferences(),
    pipeline: s.pipeline ?? defaultPipeline(),
    npsDone: Boolean(s.npsDone),
  }
}

export const useCuratorStore = create<CuratorState>()(
  devtools(
    persist(
      immer((set) => ({
        module: 'overview' as CuratorModule,
        moduleVisits: 0,
        toasts: [] as Toast[],
        density: 'comfortable' as Density,
        sidebarOpen: false,
        preferences: defaultPreferences(),
        pipeline: defaultPipeline(),
        npsDone: false,

        setModule: (m) => set((s) => {
          if (s.module !== m) { s.module = m; s.moduleVisits += 1 }
        }),
        pushToast: (t) => set((s) => {
          s.toasts.push({ ...t, id: ++toastSeq })
          if (s.toasts.length > 3) s.toasts.shift()
        }),
        dismissToast: (id) => set((s) => {
          s.toasts = s.toasts.filter((t) => t.id !== id)
        }),
        setDensity: (d) => set((s) => { s.density = d }),
        setSidebarOpen: (open) => set((s) => { s.sidebarOpen = open }),
        setPreference: (key, value) => set((s) => { s.preferences[key] = value }),
        movePipelineCard: (cardId, to, toIndex) => set((s) => {
          for (const col of Object.keys(s.pipeline) as PipelineColumn[]) {
            const i = s.pipeline[col].indexOf(cardId)
            if (i !== -1) s.pipeline[col].splice(i, 1)
          }
          const target = s.pipeline[to]
          target.splice(Math.min(Math.max(toIndex, 0), target.length), 0, cardId)
        }),
        markNpsDone: () => set((s) => { s.npsDone = true }),
      })),
      {
        name: 'labs-curator',
        version: 2,
        partialize: (s) => ({
          density: s.density, preferences: s.preferences, pipeline: s.pipeline, npsDone: s.npsDone,
        }),
        migrate: migratePersisted,
      }
    )
  )
)
