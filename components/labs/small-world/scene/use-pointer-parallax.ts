'use client'
import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { usePrefersReducedMotion, useFinePointer } from './use-reduced-motion'

/**
 * WHERE THE POINTER IS, for the camera's breath (Task 72).
 *
 * `camera-parallax.ts` owns what the numbers MEAN; this owns only how they arrive. The two are
 * separate modules so the whole mechanism can be pinned in a plain unit test with no DOM and no
 * canvas — which is what `camera-parallax.test.ts` does, and what a hook that also did the
 * arithmetic would have made impossible.
 *
 * ============================================================================
 * ONE REF, NOT THREE VALUES
 * ============================================================================
 * The rig reads this inside `useFrame`, sixty times a second, and everything it needs is in ONE
 * mutable object so there is no closure to go stale and nothing to compare. The two media queries
 * are resolved by React state (they change once, at mount) and MIRRORED into the same object by an
 * effect, rather than being read through the callback's closure: r3f re-subscribes a `useFrame`
 * callback when it changes identity, and a rig that depended on that for correctness would be
 * depending on a scheduling detail.
 *
 * ============================================================================
 * WHY THE LISTENER IS ON `window` AND WHY IT FILTERS ON `pointerType`
 * ============================================================================
 * On `window` because the canvas is `aria-hidden` and sits under an overlay that mostly disowns
 * pointer events; a listener on either would see a different subset of the viewport depending on
 * where the DOM chrome happens to be. Passive, and it never calls `preventDefault` — this reads
 * the pointer and takes nothing away from the page's own scrolling or from `onPointerMissed`.
 *
 * The `pointerType` filter is the one that matters and it is not defensive tidiness: a touch DRAG
 * fires `pointermove` events, so on a phone the scroll gesture itself would drive the orbit — the
 * camera would lurch sideways with the finger while the scroll was already moving the pull-back,
 * which is exactly the double gesture the touch path exists to avoid. Only a real hovering device
 * gets to steer.
 *
 * ============================================================================
 * THE PATH BACK TO EXACTLY ZERO
 * ============================================================================
 * `pointerout` with no `relatedTarget` is the pointer leaving the window entirely, and `blur` is
 * the tab losing focus; both put the target back to a clean 0, so the camera returns to the pose
 * the composition was solved for rather than staying frozen wherever the cursor was last seen on
 * its way out. `dampAngle`'s snap turns "returns to 0" into "returns to exactly 0", which is what
 * lets the rig go quiet again.
 */

export type ParallaxInput = {
  /** −1 at the left edge, +1 at the right, 0 dead centre. */
  x: number
  /** −1 at the top edge, +1 at the bottom, 0 dead centre. */
  y: number
  /** `prefers-reduced-motion: reduce` — suppresses the pointer orbit AND the touch drift. */
  reduced: boolean
  /** A hovering pointer exists. False ⇒ the autonomous drift instead. */
  fine: boolean
}

export function usePointerParallax(): MutableRefObject<ParallaxInput> {
  const reduced = usePrefersReducedMotion()
  const fine = useFinePointer()
  const input = useRef<ParallaxInput>({ x: 0, y: 0, reduced: false, fine: false })

  useEffect(() => {
    input.current.reduced = reduced
    input.current.fine = fine
  }, [reduced, fine])

  useEffect(() => {
    // Nothing to listen to under the preference, and nothing to listen to without a hovering
    // device — in both cases the ref stays at its zero-input value and the rig stays bit-identical
    // to the scroll camera (touch takes the drift, which needs no input at all).
    if (reduced || !fine) return

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const w = window.innerWidth
      const h = window.innerHeight
      if (!(w > 0) || !(h > 0)) return
      input.current.x = (e.clientX / w) * 2 - 1
      input.current.y = (e.clientY / h) * 2 - 1
    }
    const recentre = () => {
      input.current.x = 0
      input.current.y = 0
    }
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) recentre()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerout', onOut, { passive: true })
    window.addEventListener('blur', recentre)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerout', onOut)
      window.removeEventListener('blur', recentre)
      recentre()
    }
  }, [reduced, fine])

  return input
}
