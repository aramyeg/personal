'use client'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { connectSpacingFor, GAP_BASE, INSET_BASE, type ConnectSpacing } from './connect-clearance'

/**
 * MEASURES THE PILL ROW, ASKS THE GEOMETRY, AND HANDS BACK THE SPACINGS (Task 72 addendum).
 *
 * `connect-clearance.ts` owns every number and the argument for it; this owns only how the row's
 * rectangle arrives. Split so the whole decision is a pure function a plain unit test can sweep at
 * any viewport, which is what `connect-clearance.test.ts` does — a hook that also did the projection
 * would have made that impossible, and jsdom cannot lay out the row anyway.
 *
 * ============================================================================
 * WHY IT MEASURES INSTEAD OF DERIVING
 * ============================================================================
 * The row's height and width depend on font loading and on the label text. The restart link below it
 * is set in `--sw-font-hand` (Caveat), which arrives late; the pill labels come from `siteConfig`
 * and `socialLinks`, so adding a fifth social link changes the row's width and therefore which part
 * of the note's falling edge sits under it. A layout solved from assumed text metrics is a layout
 * that is wrong on the first paint and wrong again the day the list changes.
 *
 * ============================================================================
 * WHY THE FIXED POINT IS STABLE
 * ============================================================================
 * Applying a lift MOVES the row, so a naive re-measure would feed the moved rectangle back in and
 * chase itself. The measurement therefore recovers the row's UNLIFTED position first — `top + lift`,
 * where `lift` is exactly what this hook last applied — and asks the geometry about that. The answer
 * is then a pure function of a rectangle that does not depend on the answer, so the second pass
 * agrees with the first and the effect settles in one step rather than converging.
 *
 * `useLayoutEffect` so the corrected spacing is in place before the browser paints: the block fades
 * in over roughly 30vh of scroll, and a row that jumped 14 px on its second frame would be a visible
 * event in the one part of the lab that is meant to be settled.
 */

const BASE: ConnectSpacing = {
  gap: GAP_BASE,
  inset: INSET_BASE,
  lift: 0,
  shortfall: 0,
  clearance: Number.NaN,
}

const same = (a: ConnectSpacing, b: ConnectSpacing): boolean =>
  a.gap === b.gap && a.inset === b.inset && a.lift === b.lift

export function useConnectSpacing() {
  const navRef = useRef<HTMLElement | null>(null)
  const [spacing, setSpacing] = useState<ConnectSpacing>(BASE)
  // read inside the measurement rather than through the closure, so the callback never goes stale
  const applied = useRef(BASE)
  applied.current = spacing

  const measure = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const r = nav.getBoundingClientRect()
    if (!(r.width > 0)) return
    const next = connectSpacingFor({
      width: window.innerWidth,
      height: window.innerHeight,
      // The row's position WITHOUT whatever this hook already applied. The lift moves the row DOWN,
      // so the measured top is the unlifted one PLUS the lift, and recovering it subtracts. Getting
      // this sign backwards does not throw and does not fail a fixture-fed unit test — it makes the
      // third measurement compute a negative requirement, hand back the base layout, and undo the
      // fix on the frame after it landed. `connect-clearance.test.ts` walks the round trip for
      // exactly that reason; the render is what caught it.
      navTop: r.top - applied.current.lift,
      navLeft: r.left,
      navRight: r.right,
    })
    if (!same(next, applied.current)) setSpacing(next)
  }, [])

  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    // the row's own box changes when the hand font lands, which no resize event announces
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (ro && navRef.current) ro.observe(navRef.current)
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [measure])

  return { navRef, spacing }
}
