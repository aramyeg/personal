import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { SPREAD_COUNT } from './content'

export type TurnDir = 'next' | 'prev'
export type GrabKind = 'tab' | 'flap' | 'knob' | 'keepsake'
export type Grab = { id: string; kind: GrabKind } | null
/** A removable keepsake's macro state (hand-interaction-laws.md law H8; derived
 *  in derive-keepsake.mjs). HOME (in its sleeve) -> pull past p_exit -> OUT
 *  (seated on the desk) -> RETURNING (auto-return in flight) -> HOME. There is
 *  NO path to a turned/closed book with a card OUT. */
export type KeepsakeState = 'home' | 'out' | 'returning'

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
  /** The id of the grabbable the pointer is currently OVER (low-frequency,
   *  like `grab`, and for the same reason: cursor/affordance UI needs it on
   *  React's clock, the scrub value does not). Drives the quill cursor's
   *  pinch pose, the hover lift on the piece itself, and the parallax
   *  steadying that keeps "what the cursor says" and "what a press will hit"
   *  the same statement (BW-10/BW-11). */
  hover: string | null
  /** Per-card keepsake macro state (law H8). A card absent from the map is
   *  HOME; the layer resets its card HOME on every mount (lab exit / unmount is
   *  a state reset — a card can never persist OUT across a lab re-entry). */
  keepsakes: Record<string, KeepsakeState>
  /** The single deferred turn slot (last wins). A turn requested while any card
   *  is OUT/RETURNING is parked here and fired — bounds-checked at fire time —
   *  once every card has auto-returned HOME. */
  pendingTurn: TurnDir | null
  requestTurn: (dir: TurnDir) => void
  completeTurn: () => void
  toggleSound: () => void
  markBooted: () => void
  beginGrab: (id: string, kind: GrabKind) => void
  endGrab: () => void
  /** Claim the hover for `id`. */
  setHover: (id: string) => void
  /** Release the hover, but only if `id` still owns it — a stale `onPointerOut`
   *  from a piece the reader has already left must not blank the piece they
   *  have just arrived on. */
  clearHover: (id: string) => void
  /** HOME -> OUT: the card has detached past p_exit and is settling/seated. */
  keepsakeOut: (id: string) => void
  /** OUT -> RETURNING: the reader grabbed the seated card to send it home. */
  keepsakeReturn: (id: string) => void
  /** * -> HOME: the auto-return finished. Fires any deferred turn once every
   *  card is home again. */
  keepsakeHomed: (id: string) => void
  /** Force a card HOME with no side effects — the mount-time state reset. */
  keepsakeReset: (id: string) => void
}

/** True while any card is out of its sleeve (settling, seated, or returning) —
 *  the window in which a turn defers behind the seat rule (law H8). */
const anyKeepsakeActive = (keepsakes: Record<string, KeepsakeState>): boolean =>
  Object.values(keepsakes).some((s) => s !== 'home')

/** The normal turn transition — force-release any grab, then queue or start the
 *  turn (bounds-checked). Shared verbatim by requestTurn's no-keepsake path and
 *  the deferred-turn fire, so the turn semantics stay bit-identical whether a
 *  keepsake was ever involved or not. */
const applyTurn = (
  st: { grab: Grab; hover: string | null; turning: TurnDir | null; queued: TurnDir | null; spread: number },
  dir: TurnDir
): void => {
  st.grab = null
  st.hover = null
  if (st.turning) {
    st.queued = dir
    return
  }
  if (inBounds(st.spread, dir)) st.turning = dir
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
      hover: null,
      keepsakes: {},
      pendingTurn: null,
      requestTurn: (dir) =>
        set((st) => {
          // Law H8: a turn requested with a card OUT is never refused and never
          // leaves the spread with a card out — it SEQUENCES behind the card's
          // auto-return. Send every out card home-ward and park the turn (last
          // wins); keepsakeHomed fires it once the spread is clear again. A turn
          // requested while already RETURNING just replaces the parked turn.
          if (anyKeepsakeActive(st.keepsakes)) {
            for (const id of Object.keys(st.keepsakes)) {
              if (st.keepsakes[id] === 'out') st.keepsakes[id] = 'returning'
            }
            st.pendingTurn = dir
            return
          }
          // No keepsake involved — bit-identical to the pre-keepsake path
          // (law H2: a turn is never blocked by a grab; it force-releases first).
          applyTurn(st, dir)
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
      setHover: (id) =>
        set((st) => {
          if (st.hover !== id) st.hover = id
        }),
      clearHover: (id) =>
        set((st) => {
          if (st.hover === id) st.hover = null
        }),
      keepsakeOut: (id) => set((st) => void (st.keepsakes[id] = 'out')),
      keepsakeReturn: (id) => set((st) => void (st.keepsakes[id] = 'returning')),
      keepsakeHomed: (id) =>
        set((st) => {
          st.keepsakes[id] = 'home'
          // Fire a deferred turn only once EVERY card is home again — never
          // leave the spread with a card out (law H8).
          if (st.pendingTurn === null || anyKeepsakeActive(st.keepsakes)) return
          const dir = st.pendingTurn
          st.pendingTurn = null
          applyTurn(st, dir) // bounds-checked here, at fire time
        }),
      keepsakeReset: (id) =>
        set((st) => {
          // Mount-time reset: a fresh lab session starts every card home with
          // no parked turn, whatever a prior abnormal exit left behind.
          st.keepsakes[id] = 'home'
          if (!anyKeepsakeActive(st.keepsakes)) st.pendingTurn = null
        }),
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

/** `lockUntilMs`/`lockDir` are the post-fire cooldown (see WHEEL_COOLDOWN_MS
 *  below) — zero/null means "not locked". They ride alongside the decaying
 *  `value` accumulator so the whole gesture stays one plain object a caller
 *  can store in a ref and never has to reason about separately. */
export type WheelAcc = { value: number; lastMs: number; lockUntilMs: number; lockDir: TurnDir | null }

/** Two ordinary notches used to be enough to throw a reader a full chapter
 *  by accident (a wandering look-around scroll reads identically to a
 *  deliberate "turn the page" shove). WHEEL_THRESHOLD is raised well past
 *  that so only a clearly deliberate push fires. That alone still isn't
 *  enough, because trackpad inertia is a long train of small wheel events —
 *  a single continued gesture could decay-and-reaccumulate past threshold a
 *  second time before the reader's hand has left the pad. WHEEL_COOLDOWN_MS
 *  is a hard lockout on that: once a turn fires, the SAME direction cannot
 *  fire again until either the cooldown clock runs out (the gesture went
 *  quiet) or the reader scrolls the other way (an unambiguous new gesture,
 *  which breaks the lock immediately rather than waiting out the clock). */
export const WHEEL_THRESHOLD = 480
export const WHEEL_COOLDOWN_MS = 400

export function accumulateWheel(
  acc: WheelAcc,
  deltaY: number,
  nowMs: number
): { acc: WheelAcc; fire: TurnDir | null } {
  if (nowMs < acc.lockUntilMs) {
    // Still cooling down from the last fire. A same-direction delta is the
    // tail of the same gesture that already fired — swallow it outright (no
    // accumulation at all) so a long inertia train can never creep back up
    // to threshold on its own. A reversal is treated as a brand new gesture:
    // fall through and accumulate it normally (acc.value is still 0 from the
    // fire, so this starts clean — that IS "reset by direction reversal").
    const reversed = acc.lockDir === 'next' ? deltaY < 0 : deltaY > 0
    if (!reversed) {
      return { acc: { ...acc, lastMs: nowMs }, fire: null }
    }
  }
  const dt = Math.max(0, nowMs - acc.lastMs)
  const decayed = acc.value * Math.pow(0.5, dt / 200)
  const value = decayed + deltaY
  if (Math.abs(value) >= WHEEL_THRESHOLD) {
    const dir: TurnDir = value > 0 ? 'next' : 'prev'
    return { acc: { value: 0, lastMs: nowMs, lockUntilMs: nowMs + WHEEL_COOLDOWN_MS, lockDir: dir }, fire: dir }
  }
  return { acc: { value, lastMs: nowMs, lockUntilMs: 0, lockDir: null }, fire: null }
}
