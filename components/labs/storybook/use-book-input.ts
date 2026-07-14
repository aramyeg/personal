'use client'

/**
 * Plain DOM input grammar for the book: wheel, keyboard, and pointer swipe
 * all funnel into `requestTurn`, which already owns bounds/queueing (see
 * store.ts). Lives outside the r3f canvas (the loader mounts it alongside
 * `<BookScene/>`), uses window listeners with no capture phase, and never
 * touches Escape — that key belongs exclusively to `<GalleryChrome>`.
 *
 * Hit-target disambiguation (hand-interaction-laws.md law H1): a handle
 * grab starts on the r3f canvas's own pointerdown, which runs first on the
 * bubble path — the canvas listener attaches directly to the element,
 * while this file listens on `window` without capture. `onPointerDown`
 * below checks `store.grab` and, if a grab is already active, records no
 * swipe start at all. `onPointerUp` needs no matching check: with no start
 * recorded, the swipe is already inert no matter which handler releases
 * the grab first (suppress at start, not at end).
 */

import { useEffect, useRef } from 'react'
import { accumulateWheel, useStorybookStore, type TurnDir, type WheelAcc } from './store'

const SWIPE_MIN_PX = 60
const SWIPE_MAX_MS = 600

type PointerStart = { x: number; y: number; t: number }

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
  const wheelAcc = useRef<WheelAcc>({ value: 0, lastMs: 0 })
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

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          requestTurn('next')
          break
        case ' ':
          e.preventDefault()
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

    const onPointerDown = (e: PointerEvent) => {
      if (targetsOverlayPanel(e.target)) return
      if (useStorybookStore.getState().grab !== null) return
      pointerStart.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    }

    const onPointerUp = (e: PointerEvent) => {
      const start = pointerStart.current
      pointerStart.current = null
      if (!start || performance.now() - start.t > SWIPE_MAX_MS) return

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

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [enabled])
}
