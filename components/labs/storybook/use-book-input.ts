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
 * lab entirely with no confirmation. So `onEscapeDuringGrab` below listens
 * in the CAPTURE phase (must win the race against GalleryChrome's
 * bubble-phase handler regardless of mount order — the same reason
 * snowpark's input.ts captures Escape) and, only while a grab is live,
 * calls `preventDefault()` and releases the grab instead of letting the
 * key reach GalleryChrome. With no grab active, it does nothing and the
 * key proceeds to GalleryChrome exactly as before.
 */

import { useEffect, useRef } from 'react'
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

export function useBookInput(enabled: boolean): void {
  const wheelAcc = useRef<WheelAcc>({ value: 0, lastMs: 0, lockUntilMs: 0, lockDir: null })
  const pointerStart = useRef<PointerStart | null>(null)

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
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          requestTurn('next')
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Home':
          requestTurn('prev')
          break
        default:
          break
      }
    }

    // See the file header: only intercepts Escape while a grab is live, and
    // only to release that grab — GalleryChrome's own Escape handling is
    // otherwise untouched.
    const onEscapeDuringGrab = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (useStorybookStore.getState().grab === null) return
      e.preventDefault()
      useStorybookStore.getState().endGrab()
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
    window.addEventListener('keydown', onEscapeDuringGrab, true)
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
      window.removeEventListener('keydown', onEscapeDuringGrab, true)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onCornerHint)
      window.removeEventListener('pointerup', endAnyGrab)
      window.removeEventListener('pointercancel', endAnyGrab)
      window.removeEventListener('lostpointercapture', endAnyGrab)
      window.removeEventListener('blur', endAnyGrab)
      delete document.documentElement.dataset.sbCorner
    }
  }, [enabled])
}
