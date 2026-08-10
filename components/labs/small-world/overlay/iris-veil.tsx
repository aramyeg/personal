'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PALETTE } from '../palette'
import { pinScrollToTop } from '../scroll-reset'
import { usePrefersReducedMotion } from '../scene/use-reduced-motion'
import {
  IRIS_START,
  VEIL_EDGE,
  VEIL_OPEN,
  VEIL_RIM,
  holdMsFor,
  veilStateAt,
} from './iris-transition'

/**
 * THE IRIS, as it reaches the screen. `iris-transition.ts` carries the design, the measurement that
 * killed the rewind, the timing and the destinations; this file is two masked divs and the frame
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
 * leave. This is the one case a full-frame catcher is honest — it is opaque, it is on screen for
 * under a second and a half, and it exists for exactly as long as it is drawn.
 *
 * ── WHAT `seek` IS FOR (Task 108) ─────────────────────────────────────────────────────────────
 * The hook does not know how tall the track is and must not: the progress → pixels mapping belongs
 * to the component that owns the track element, and it is already written there for tap-to-advance.
 * So the caller supplies it, and the ONE thing this file promises about it is WHEN it is called —
 * on the frame the iris is shut, and never before.
 *
 * `IRIS_START` is the exception and it is deliberate: "the top" is the one destination the lab
 * already has an authority for (`pinScrollToTop`, which also defeats scroll restoration and is the
 * same call the mount pin makes), so the restart keeps landing through it exactly as Task 106
 * measured. Every other destination goes through the caller's mapping.
 */
export function useIrisVeil(seek: (progress: number) => void): {
  veil: ReactNode
  iris: (target: number) => void
} {
  const reduced = usePrefersReducedMotion()
  /** The destination of the gesture in flight, or null while there is none. */
  const [target, setTarget] = useState<number | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  // Read inside the callback rather than closed over, so a preference change mid-visit takes
  // effect without re-identifying the handler the ending block already holds.
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const seekRef = useRef(seek)
  seekRef.current = seek

  const jump = useCallback((to: number) => {
    if (to <= IRIS_START) pinScrollToTop()
    else seekRef.current(to)
  }, [])

  const iris = useCallback(
    (to: number) => {
      if (reducedRef.current) {
        // The cut, with none of the gesture — and the same one call the covered path makes.
        jump(to)
        return
      }
      setTarget(to)
    },
    [jump]
  )

  useEffect(() => {
    if (target === null) return
    const hold = holdMsFor(target)
    let raf = 0
    let start = 0
    let jumped = false
    const step = (now: number) => {
      if (start === 0) start = now
      const s = veilStateAt(now - start, hold)
      if (s.jump && !jumped) {
        jumped = true
        // THE WHOLE OF WHAT THIS TRANSITION DOES TO THE DOCUMENT, and it happens with the iris
        // shut. One instant jump, so the scene lands where a scroll to the same place lands.
        jump(target)
      }
      wrap.current?.style.setProperty('--sw-veil-r', `${s.radius}%`)
      if (s.done) {
        setTarget(null)
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, jump])

  const veil =
    target !== null ? (
      <div
        ref={wrap}
        data-testid="sw-iris-veil"
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'auto',
          /**
           * BEING LAST IN THE TREE IS NOT THE SAME AS BEING ON TOP, which is what the restart got
           * away with and the skip could not. A positive z-index beats every `auto` sibling
           * whatever the DOM order, and the lab has several: the chapter spread stacks its cards
           * at 1 and 2 on a phone, its tab at 3, the manga lightbox at 40, the plain CV at 50 and
           * the tune panel at 60. The restart never met any of them — it is only reachable at the
           * ending, where the spread is gone — but the skip is pressed from inside a chapter, so
           * an un-ranked cover would have had the comic page painted straight through it. 70 is
           * this file's own claim, stated as a number: it covers everything the overlay draws.
           */
          zIndex: 70,
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

  return { veil, iris }
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
