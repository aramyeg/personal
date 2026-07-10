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

let toastSeq = 0

type CuratorState = {
  module: CuratorModule
  moduleVisits: number
  toasts: Toast[]
  density: Density
  sidebarOpen: boolean
  notifications: { productUpdates: boolean; weeklyDigest: boolean; incidentAlerts: boolean }
  pipeline: PipelineState
  npsDone: boolean
  setModule(m: CuratorModule): void
  pushToast(t: Omit<Toast, 'id'>): void
  dismissToast(id: number): void
  setDensity(d: Density): void
  setSidebarOpen(open: boolean): void
  setNotification(key: keyof CuratorState['notifications'], value: boolean): void
  movePipelineCard(cardId: string, to: PipelineColumn, toIndex: number): void
  markNpsDone(): void
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
        notifications: { productUpdates: true, weeklyDigest: true, incidentAlerts: false },
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
        setNotification: (key, value) => set((s) => { s.notifications[key] = value }),
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
        version: 1,
        partialize: (s) => ({
          density: s.density, notifications: s.notifications, pipeline: s.pipeline, npsDone: s.npsDone,
        }),
      }
    )
  )
)
