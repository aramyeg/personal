import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { SPREAD_COUNT } from './content'

export type TurnDir = 'next' | 'prev'
export type GrabKind = 'tab' | 'flap' | 'knob' | 'keepsake'
export type Grab = { id: string; kind: GrabKind } | null

const inBounds = (spread: number, dir: TurnDir) =>
  dir === 'next' ? spread < SPREAD_COUNT - 1 : spread > 0

type SbState = {
  spread: number
  turning: TurnDir | null
  queued: TurnDir | null
  soundOn: boolean
  /** True once the WebGL book has actually warmed up: a run of real frames
   *  rendered and every warm-window print resolved (book.tsx flips it from
   *  the frame loop). Gates the boot veil, the "Open the book" CTA and all
   *  turn input, so the first turn can never start against a half-loaded
   *  scene. */
  booted: boolean
  /** The LOW-FREQUENCY identity of an active handle grab (hand-interaction-
   *  laws.md law H2) — which piece, what kind. The high-frequency scrub
   *  value it drives lives outside React entirely (see user-drive.ts); this
   *  field exists only so cursor/affordance UI can react to grab start/end. */
  grab: Grab
  requestTurn: (dir: TurnDir) => void
  completeTurn: () => void
  toggleSound: () => void
  markBooted: () => void
  beginGrab: (id: string, kind: GrabKind) => void
  endGrab: () => void
}

export const useStorybookStore = create<SbState>()(
  devtools(
    immer((set) => ({
      spread: 0,
      turning: null,
      queued: null,
      soundOn: false,
      booted: false,
      grab: null,
      requestTurn: (dir) =>
        set((st) => {
          // Law H2: a turn request is never blocked by a grab — it force-
          // releases the grab first, then proceeds exactly as if no grab
          // had been active.
          st.grab = null
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
      markBooted: () => set((st) => void (st.booted = true)),
      beginGrab: (id, kind) =>
        set((st) => {
          // Legal only at settled rest — the caller (a handle's onPointerDown)
          // already hit-tested, so an illegal call silently no-ops rather
          // than surfacing an error the caller can't act on.
          if (!st.booted || st.turning !== null) return
          st.grab = { id, kind }
        }),
      endGrab: () => set((st) => void (st.grab = null)),
    })),
    { name: 'storybook-lab' }
  )
)

// Dev-only escape hatch for the bench probes (.superpowers/sdd/bench): lets
// a Playwright page subscribe to store transitions and time them against the
// frame loop. Compiled out of production builds, like ?sbpose.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __sbStore?: typeof useStorybookStore }).__sbStore = useStorybookStore
}

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
