'use client'

/**
 * Plain DOM input grammar for the book: wheel, keyboard, and pointer swipe
 * all funnel into `requestTurn`, which already owns bounds/queueing (see
 * store.ts). Lives outside the r3f canvas (the loader mounts it alongside
 * `<BookScene/>`), uses window listeners with no capture phase, and never
 * touches Escape — that key belongs exclusively to `<GalleryChrome>`.
 */

import { useEffect, useRef } from 'react'
import { accumulateWheel, useStorybookStore, type TurnDir, type WheelAcc } from './store'

const SWIPE_MIN_PX = 60
const SWIPE_MAX_MS = 600

type PointerStart = { x: number; y: number; t: number }

/** Portrait layout turns `.sb-overlay` into a real scrollable parchment
 *  panel (storybook-responsive.css) sitting beside the canvas rather than
 *  pageRect-tracking on top of it. A wheel or drag gesture that starts (or,
 *  for wheel, bubbles from) inside that panel is the user scrolling the
 *  narration, not swiping/spinning to turn the page — both gesture paths
 *  route through this same check so neither eats the panel's scroll.
 *  Canvas gestures and the corner hotspots (outside the panel) are
 *  unaffected. */
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
