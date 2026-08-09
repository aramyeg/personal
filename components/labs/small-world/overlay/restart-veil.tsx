'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PALETTE } from '../palette'
import { pinScrollToTop } from '../scroll-reset'
import { usePrefersReducedMotion } from '../scene/use-reduced-motion'
import {
  VEIL_EDGE,
  VEIL_OPEN,
  VEIL_RIM,
  veilStateAt,
} from './restart-transition'

/**
 * THE RESTART'S IRIS, as it reaches the screen. `restart-transition.ts` carries the design, the
 * measurement that killed the rewind, and the timing; this file is two masked divs and the frame
 * loop that drives them.
 *
 * ONE STYLE WRITE PER FRAME, AND NO REACT RENDER. Both layers read the same custom property, so
 * the loop sets `--sw-veil-r` on the wrapper and the browser does the rest. React sees exactly two
 * state changes for the whole gesture — mount and unmount — which matters because the frame this
 * runs over is the one the scene is re-drawing the whole world into.
 *
 * WHY IT TAKES POINTER EVENTS. The overlay root is `pointer-events: none` and the click model
 * underneath is canvas-first: `onPointerMissed` advances panels. A click landing during the cover
 * would therefore reach a canvas the visitor cannot see and advance a story they just asked to
 * restart. This is the one case a full-frame catcher is honest — it is opaque, it is on screen for
 * under a second, and it exists for exactly as long as it is drawn.
 */
export function useRestartVeil(): { veil: ReactNode; restart: () => void } {
  const reduced = usePrefersReducedMotion()
  const [running, setRunning] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  // Read inside the callback rather than closed over, so a preference change mid-visit takes
  // effect without re-identifying the handler the ending block already holds.
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  const restart = useCallback(() => {
    if (reducedRef.current) {
      // The cut, with none of the gesture — and the same one call the covered path makes.
      pinScrollToTop()
      return
    }
    setRunning(true)
  }, [])

  useEffect(() => {
    if (!running) return
    let raf = 0
    let start = 0
    let jumped = false
    const step = (now: number) => {
      if (start === 0) start = now
      const s = veilStateAt(now - start)
      if (s.jump && !jumped) {
        jumped = true
        // THE WHOLE OF WHAT THIS TRANSITION DOES TO THE DOCUMENT, and it happens with the iris
        // shut. Same call the lab makes on mount, so the scene lands where a fresh load lands.
        pinScrollToTop()
      }
      wrap.current?.style.setProperty('--sw-veil-r', `${s.radius}%`)
      if (s.done) {
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const veil = running ? (
    <div
      ref={wrap}
      data-testid="sw-restart-veil"
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        // The iris opens from here on the first frame; the loop overwrites it immediately.
        ['--sw-veil-r' as string]: `${VEIL_OPEN}%`,
      }}
    >
      <div style={layer(PALETTE.neonRose, `transparent var(--sw-veil-r), #000 calc(var(--sw-veil-r) + ${VEIL_EDGE}%)`)} />
      <div
        style={layer(
          PALETTE.studioRoseDeep,
          `transparent var(--sw-veil-r), #000 calc(var(--sw-veil-r) + 0.3%), #000 calc(var(--sw-veil-r) + ${VEIL_RIM}%), transparent calc(var(--sw-veil-r) + ${VEIL_RIM + 0.6}%)`
        )}
      />
    </div>
  ) : null

  return { veil, restart }
}

/** One masked field. The centre sits a little above the frame's middle, which is where the globe
 *  is at the money shot AND where the planet is at the top of the track — one circle, both ends. */
function layer(color: string, stops: string): React.CSSProperties {
  const mask = `radial-gradient(circle at 50% 42%, ${stops})`
  return {
    position: 'absolute',
    inset: 0,
    background: color,
    WebkitMaskImage: mask,
    maskImage: mask,
  }
}
