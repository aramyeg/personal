import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { SPREAD_COUNT } from './content'

export type TurnDir = 'next' | 'prev'
export type PageRect = { left: number; top: number; width: number; height: number }

const inBounds = (spread: number, dir: TurnDir) =>
  dir === 'next' ? spread < SPREAD_COUNT - 1 : spread > 0

type SbState = {
  spread: number
  turning: TurnDir | null
  queued: TurnDir | null
  soundOn: boolean
  pageRect: PageRect | null
  requestTurn: (dir: TurnDir) => void
  completeTurn: () => void
  toggleSound: () => void
  setPageRect: (r: PageRect | null) => void
}

export const useStorybookStore = create<SbState>()(
  devtools(
    immer((set) => ({
      spread: 0,
      turning: null,
      queued: null,
      soundOn: false,
      pageRect: null,
      requestTurn: (dir) =>
        set((st) => {
          if (st.turning) {
            st.queued = dir
            return
          }
          if (inBounds(st.spread, dir)) st.turning = dir
        }),
      completeTurn: () =>
        set((st) => {
          if (!st.turning) return
          st.spread += st.turning === 'next' ? 1 : -1
          st.turning = st.queued && inBounds(st.spread, st.queued) ? st.queued : null
          st.queued = null
        }),
      toggleSound: () => set((st) => void (st.soundOn = !st.soundOn)),
      setPageRect: (r) => set((st) => void (st.pageRect = r)),
    })),
    { name: 'storybook-lab' }
  )
)

export type WheelAcc = { value: number; lastMs: number }
export const WHEEL_THRESHOLD = 160

export function accumulateWheel(
  acc: WheelAcc,
  deltaY: number,
  nowMs: number
): { acc: WheelAcc; fire: TurnDir | null } {
  const dt = Math.max(0, nowMs - acc.lastMs)
  const decayed = acc.value * Math.pow(0.5, dt / 200)
  const value = decayed + deltaY
  if (Math.abs(value) >= WHEEL_THRESHOLD) {
    return { acc: { value: 0, lastMs: nowMs }, fire: value > 0 ? 'next' : 'prev' }
  }
  return { acc: { value, lastMs: nowMs }, fire: null }
}
