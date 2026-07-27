'use client'

/**
 * Plain DOM input grammar for the book: wheel, keyboard, and pointer swipe
 * all funnel into `requestTurn`, which already owns bounds/queueing (see
 * store.ts). Lives outside the r3f canvas (the loader mounts it alongside
 * `<BookScene/>`), uses window listeners with no capture phase — with ONE
 * deliberate exception, the Escape interception below.
 *
 * Hit-target disambiguation (hand-interaction-laws.md law H1): a handle
 * grab starts on the r3f canvas's own pointerdown, which runs first on the
 * bubble path — the canvas listener attaches directly to the element,
 * while this file listens on `window` without capture. `onPointerDown`
 * below checks `store.grab` and, if a grab is already active, records no
 * swipe start at all. `onPointerUp` needs no matching check: with no start
 * recorded, the swipe is already inert no matter which handler releases
 * the grab first (suppress at start, not at end).
 *
 * Escape ordinarily belongs exclusively to `<GalleryChrome>` (exit to
 * /labs) — this file does not decide when the reader leaves the lab. But a
 * reader with a handle mid-grab who taps Escape to back out of the
 * interaction, not the whole book, was instead getting yanked out of the
 * lab entirely with no confirmation. So `onEscape` below listens in the
 * CAPTURE phase (must win the race against GalleryChrome's bubble-phase
 * handler regardless of mount order — the same reason snowpark's input.ts
 * captures Escape) and, while a grab is live, calls `preventDefault()` and
 * releases the grab instead of letting the key reach GalleryChrome.
 *
 * SP-3(d): with no grab live, that same listener now spends the FIRST
 * Escape on a warning instead of the exit ("Escape still ejects to /labs
 * unannounced" — the reader loses the book to one stray key). It arms a
 * whisper in the book's own voice (ESCAPE_WHISPER, rendered by nav.tsx) and
 * swallows the key; a second Escape inside ESCAPE_CONFIRM_MS is let through
 * untouched and GalleryChrome exits exactly as it always did. The window is
 * one setTimeout, so the counter and the whisper can never disagree about
 * whether the offer is still open. A grab-release Escape is not a step in
 * that sequence — it belongs to the piece in the reader's hand, and
 * counting it would let a reader lose the book while trying to let go of a
 * flap.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { accumulateWheel, useStorybookStore, type TurnDir, type WheelAcc } from './store'
import { activeGrabId, forceEndGrabChannel } from './user-drive'
import { cornerTurnAt, isCornerTap } from './overlay/corner-hotspot'

const SWIPE_MIN_PX = 60
const SWIPE_MAX_MS = 600

type PointerStart = { x: number; y: number; t: number; corner: TurnDir | null }

/** `.sb-overlay` is the book's HTML text layer: fixed side columns flanking
 *  the (always screen-centered) book on desktop, a bottom drawer over the
 *  scene in portrait (storybook-responsive.css) — expandable, and
 *  internally scrollable, via its own `.sb-drawer-toggle`. A wheel or drag
 *  gesture that starts (or, for wheel, bubbles from) inside it is the user
 *  reading/scrolling the text, not swiping/spinning to turn the page — both
 *  gesture paths route through this same check so neither eats the
 *  overlay's own scroll or clicks. Canvas gestures and the corner hotspots
 *  (outside the overlay) are unaffected. */
const targetsOverlayPanel = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('.sb-overlay') !== null

// ---------------------------------------------------------------------------
// THE ESCAPE WHISPER (SP-3 d). The copy and the window are exported so the
// gate pins the reader's actual grace period, not a number retyped in a test.

/** How long the offer stays open after the first Escape. Long enough to read
 *  six words, short enough that a reader who meant nothing by the key has
 *  forgotten it before the next one. */
export const ESCAPE_CONFIRM_MS = 2000
/** The whisper itself — the book's voice (lowercase, no shouting), not a
 *  dialog's. Rendered by nav.tsx in the plaque/kicker type. */
export const ESCAPE_WHISPER = 'press escape again to close the book'

let whisperShown = false
const whisperListeners = new Set<() => void>()

const setWhisper = (next: boolean): void => {
  if (whisperShown === next) return
  whisperShown = next
  for (const listener of whisperListeners) listener()
}

const subscribeWhisper = (listener: () => void): (() => void) => {
  whisperListeners.add(listener)
  return () => {
    whisperListeners.delete(listener)
  }
}

/** Whether the "press escape again" whisper is currently offered. Module
 *  state rather than store state: the guard is a property of the KEYBOARD
 *  listener's own life, not of the book's position, and nothing outside this
 *  file may arm or disarm it. */
export const escapeWhisperShown = (): boolean => whisperShown

/** Subscription for the chrome that draws the whisper (overlay/nav.tsx). */
export function useEscapeWhisper(): boolean {
  return useSyncExternalStore(subscribeWhisper, escapeWhisperShown, () => false)
}

export function useBookInput(enabled: boolean): void {
  const wheelAcc = useRef<WheelAcc>({ value: 0, lastMs: 0, lockUntilMs: 0, lockDir: null })
  const pointerStart = useRef<PointerStart | null>(null)
  const escapeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const requestTurn = (dir: TurnDir) => useStorybookStore.getState().requestTurn(dir)

    const onWheel = (e: WheelEvent) => {
      if (targetsOverlayPanel(e.target)) return
      const { acc, fire } = accumulateWheel(wheelAcc.current, e.deltaY, performance.now())
      wheelAcc.current = acc
      if (fire) requestTurn(fire)
    }

    // Space is deliberately NOT bound here: it is not a page-turn idiom for
    // a book, and a reader poking at the scene (the handles, the corner
    // hotspots) taps Space far more readily than a keyboard reader reaches
    // for it as "next page" — binding it cost readers their spread.
    //
    // SP-3(a): neither is ArrowUp/ArrowDown ("all four arrows turn pages" —
    // blind reviewer). A book turns left and right; up and down belong to the
    // narration the reader is scrolling in the drawer, and this listener sits
    // on `window` where it would have taken them from any unfocused scroll.
    // Nothing here calls preventDefault, so the two keys reach the drawer
    // (and the page) with their native scrolling intact.
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          requestTurn('next')
          break
        case 'ArrowLeft':
        case 'PageUp':
        case 'Home':
          requestTurn('prev')
          break
        default:
          break
      }
    }

    const disarmEscape = () => {
      if (escapeTimer.current !== null) clearTimeout(escapeTimer.current)
      escapeTimer.current = null
      setWhisper(false)
    }

    // See the file header. Two jobs, in priority order: release a live grab
    // (the reader is backing out of a piece, not the book), and otherwise
    // spend the first Escape on the whisper instead of the exit.
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (useStorybookStore.getState().grab !== null) {
        e.preventDefault()
        useStorybookStore.getState().endGrab()
        return
      }
      // Second press inside the window: this one is meant, so it goes through
      // untouched — GalleryChrome sees a pristine Escape and exits.
      if (escapeTimer.current !== null) {
        disarmEscape()
        return
      }
      // First press: swallow it. `stopPropagation` from the capture phase on
      // `window` keeps the key from ever reaching GalleryChrome's own window
      // listener; `preventDefault` is the belt for any other reader of the
      // key (GalleryChrome bails on `defaultPrevented`).
      e.preventDefault()
      e.stopPropagation()
      setWhisper(true)
      escapeTimer.current = setTimeout(() => {
        escapeTimer.current = null
        setWhisper(false)
      }, ESCAPE_CONFIRM_MS)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (targetsOverlayPanel(e.target)) return
      // The canvas listener has already run on the bubble path (see the header),
      // so `grab` is authoritative here: a press that took hold of a piece is a
      // grab, never a swipe and never a corner turn. `hover` covers the same
      // press before the scene has decided (a handle that refused the press for
      // its own reasons still owns the pixel the reader aimed at).
      const st = useStorybookStore.getState()
      if (st.grab !== null) return
      const corner =
        st.hover === null ? cornerTurnAt(e.clientX, e.clientY, window.innerWidth, window.innerHeight) : null
      pointerStart.current = { x: e.clientX, y: e.clientY, t: performance.now(), corner }
    }

    const onPointerUp = (e: PointerEvent) => {
      const start = pointerStart.current
      pointerStart.current = null
      if (!start) return

      // CORNER TURN (R-4). The hotspots no longer take pointer events of their
      // own — the paper under them has to be reachable — so the tap that turns
      // the page is recognised here, and only if the scene had nothing to offer
      // at the press. A press-drag through a corner falls through to the swipe
      // rule below exactly like a press-drag anywhere else.
      if (start.corner !== null) {
        if (isCornerTap(start.x, start.y, start.t, e.clientX, e.clientY, performance.now())) {
          requestTurn(start.corner)
          return
        }
      }
      if (performance.now() - start.t > SWIPE_MAX_MS) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      if (absDx < SWIPE_MIN_PX && absDy < SWIPE_MIN_PX) return

      // Dominant axis wins so a diagonal swipe fires exactly one turn.
      if (absDx >= absDy) {
        requestTurn(dx < 0 ? 'next' : 'prev')
      } else {
        requestTurn(dy < 0 ? 'next' : 'prev')
      }
    }

    // THE RELEASE BACKSTOP (R-1, the re-review's blocker: "after pointerup the
    // mechanism keeps tracking the mouse… the page feels possessed"). A handle
    // layer can only hear a `pointerup` that r3f delivers to its own mesh, and
    // r3f only does that while the pointer capture holds — it also swallows
    // `pointercancel` and `lostpointercapture` before they ever reach an object
    // (see user-drive.ts's note). Any capture loss mid-drag therefore stranded
    // the grab for the rest of the session, with the naked pointer still driving
    // the piece. This runs on WINDOW, after the canvas has had its own go, and
    // ends whatever is still held: the layer's own teardown first (so the tap
    // nudge and the scrub channel behave exactly as on a normal release), then
    // the store, unconditionally.
    const endAnyGrab = () => {
      if (useStorybookStore.getState().grab === null && activeGrabId() === null) return
      forceEndGrabChannel()
      useStorybookStore.getState().endGrab()
    }

    // The corner fold answers the pointer even though its button no longer takes
    // events (R-4): the same rect test that arms the turn lifts the dog-ear, so
    // the hint appears exactly where the tap would work and stays away when the
    // scene owns that pixel.
    const onCornerHint = (e: PointerEvent) => {
      const st = useStorybookStore.getState()
      const corner =
        st.grab === null && st.hover === null
          ? cornerTurnAt(e.clientX, e.clientY, window.innerWidth, window.innerHeight)
          : null
      const value = corner === 'prev' ? 'left' : corner === 'next' ? 'right' : ''
      const root = document.documentElement
      if ((root.dataset.sbCorner ?? '') !== value) {
        if (value === '') delete root.dataset.sbCorner
        else root.dataset.sbCorner = value
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    // Capture phase: must run before GalleryChrome's bubble-phase Escape
    // handler regardless of which mounts first, or the endGrab()
    // preventDefault loses the race and Esc navigates away instead of
    // releasing the grab (mirrors snowpark's input.ts).
    window.addEventListener('keydown', onEscape, true)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onCornerHint)
    // Bubble phase on purpose: the canvas element's own listener has already
    // run, so a grab that ended normally is already gone and this sees nothing
    // to do. It only fires for real when the pointer stream ended somewhere the
    // scene never heard about.
    window.addEventListener('pointerup', endAnyGrab)
    window.addEventListener('pointercancel', endAnyGrab)
    window.addEventListener('lostpointercapture', endAnyGrab)
    window.addEventListener('blur', endAnyGrab)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keydown', onEscape, true)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onCornerHint)
      window.removeEventListener('pointerup', endAnyGrab)
      window.removeEventListener('pointercancel', endAnyGrab)
      window.removeEventListener('lostpointercapture', endAnyGrab)
      window.removeEventListener('blur', endAnyGrab)
      // An armed whisper must not outlive the listener that could honour it:
      // with the hook gone, a second Escape would be a first press again.
      disarmEscape()
      delete document.documentElement.dataset.sbCorner
    }
  }, [enabled])
}
