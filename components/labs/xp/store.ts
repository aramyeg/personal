import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'

export type XpAppId =
  | 'my-computer' | 'my-projects' | 'project-detail' | 'resume' | 'about'
  | 'messenger' | 'internet-explorer' | 'add-remove' | 'recycle-bin'

export type XpWindow = {
  id: string
  app: XpAppId
  title: string
  x: number; y: number
  w: number; h: number
  z: number
  minimized: boolean
  maximized: boolean
  param?: string
}

export type BootPhase = 'boot' | 'welcome' | 'desktop'
export type ChaosPhase = 'idle' | 'cascade' | 'bsod'

export const CHAOS_DIALOG_CAP = 12

const windowId = (app: XpAppId, param?: string) =>
  app === 'project-detail' ? `project-detail:${param}` : app

type XpState = {
  phase: BootPhase
  windows: XpWindow[]
  activeId: string | null
  nextZ: number
  opened: number
  startOpen: boolean
  muted: boolean
  clippyDismissed: boolean
  screensaver: boolean
  chaos: ChaosPhase
  chaosDialogs: number[]
  chaosSpawned: number
  setPhase: (p: BootPhase) => void
  openWindow: (app: XpAppId, opts?: { param?: string; title?: string; maximized?: boolean; w?: number; h?: number }) => void
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  clickTaskButton: (id: string) => void
  toggleMaximize: (id: string) => void
  moveWindow: (id: string, x: number, y: number) => void
  setStartOpen: (open: boolean) => void
  toggleMuted: () => void
  dismissClippy: () => void
  setScreensaver: (on: boolean) => void
  startChaos: () => void
  closeChaosDialog: (seed: number) => void
  rebootFromBsod: () => void
}

export const useXpStore = create<XpState>()(
  devtools(
    immer((set) => ({
      phase: 'boot',
      windows: [],
      activeId: null,
      nextZ: 1,
      opened: 0,
      startOpen: false,
      muted: false,
      clippyDismissed: false,
      screensaver: false,
      chaos: 'idle',
      chaosDialogs: [],
      chaosSpawned: 0,

      setPhase: (p) => set((s) => { s.phase = p }),

      openWindow: (app, opts) =>
        set((s) => {
          const id = windowId(app, opts?.param)
          const existing = s.windows.find((w) => w.id === id)
          if (existing) {
            existing.minimized = false
            existing.z = s.nextZ++
            s.activeId = id
            return
          }
          const n = s.opened++ % 8
          s.windows.push({
            id, app,
            title: opts?.title ?? app,
            x: 96 + n * 28, y: 64 + n * 28,
            w: opts?.w ?? 560, h: opts?.h ?? 400,
            z: s.nextZ++,
            minimized: false,
            maximized: opts?.maximized ?? false,
            param: opts?.param,
          })
          s.activeId = id
          s.startOpen = false
        }),

      closeWindow: (id) =>
        set((s) => {
          s.windows = s.windows.filter((w) => w.id !== id)
          if (s.activeId === id) {
            const top = [...s.windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]
            s.activeId = top?.id ?? null
          }
        }),

      focusWindow: (id) =>
        set((s) => {
          const w = s.windows.find((w) => w.id === id)
          if (!w) return
          w.z = s.nextZ++
          s.activeId = id
        }),

      clickTaskButton: (id) =>
        set((s) => {
          const w = s.windows.find((w) => w.id === id)
          if (!w) return
          if (w.minimized) {
            w.minimized = false
            w.z = s.nextZ++
            s.activeId = id
          } else if (s.activeId === id) {
            w.minimized = true
            s.activeId = null
          } else {
            w.z = s.nextZ++
            s.activeId = id
          }
        }),

      toggleMaximize: (id) =>
        set((s) => {
          const w = s.windows.find((w) => w.id === id)
          if (w) w.maximized = !w.maximized
        }),

      moveWindow: (id, x, y) =>
        set((s) => {
          const w = s.windows.find((w) => w.id === id)
          if (w) { w.x = x; w.y = y }
        }),

      setStartOpen: (open) => set((s) => { s.startOpen = open }),
      toggleMuted: () => set((s) => { s.muted = !s.muted }),
      dismissClippy: () => set((s) => { s.clippyDismissed = true }),
      setScreensaver: (on) => set((s) => { s.screensaver = on }),

      startChaos: () =>
        set((s) => {
          s.chaos = 'cascade'
          s.chaosDialogs = [0]
          s.chaosSpawned = 1
        }),

      closeChaosDialog: (seed) =>
        set((s) => {
          s.chaosDialogs = s.chaosDialogs.filter((d) => d !== seed)
          if (s.chaosSpawned >= CHAOS_DIALOG_CAP) {
            s.chaos = 'bsod'
            return
          }
          s.chaosDialogs.push(s.chaosSpawned, s.chaosSpawned + 1)
          s.chaosSpawned += 2
        }),

      rebootFromBsod: () =>
        set((s) => {
          s.chaos = 'idle'
          s.chaosDialogs = []
          s.chaosSpawned = 0
        }),
    })),
    { name: 'XpStore' }
  )
)
