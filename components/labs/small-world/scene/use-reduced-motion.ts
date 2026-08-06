'use client'
import { useEffect, useState } from 'react'

/**
 * `prefers-reduced-motion: reduce`, read ONCE at mount.
 *
 * Read once rather than subscribed, which is the treatment `peekers.tsx` and `yeti-egg.tsx` already
 * give the same query: a visitor who flips the OS setting mid-scroll is not a case worth a listener
 * on a scene whose whole point is that it is a pure function of scroll, and a mid-journey change
 * that re-rendered the canvas would be a bigger motion event than the one it suppressed.
 *
 * Belt and braces in both of those files and in this one: `small-world-experience.tsx` already
 * swaps the entire 3D experience for the static career timeline when a visitor prefers reduced
 * motion, so nothing that reads this hook is normally mounted at all under the preference. It is a
 * GUARANTEE for the paths that can still reach a canvas — a Storybook story, a test harness, a
 * future entry point — rather than the primary gate.
 *
 * Starts `false` so the server render and the first client render agree; the effect corrects it
 * before any frame that could show the difference.
 *
 * It lives in its own module because Task 72 gave it a THIRD consumer (the camera's pointer
 * parallax) and a fourth (the coffee steam), and three copies of a matchMedia string is how two of
 * them end up disagreeing about which query they test.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  return reduced
}

/**
 * Whether the visitor has a PRECISE pointer — a mouse or a trackpad, as opposed to a finger.
 *
 * `(pointer: fine)` describes the PRIMARY input, which is exactly the question here: the parallax
 * follows a pointer that can be held still somewhere specific, and a finger cannot hover at all.
 * A device that answers false gets the autonomous drift instead (see `camera-parallax.ts`), so
 * being wrong in that direction costs a slow drift on a device that also has a mouse — not a dead
 * feature. Being wrong the other way would leave a touch visitor with a camera that never moves,
 * which is the failure worth avoiding.
 *
 * Read once at mount for the same reason as above. Defaults to `false` — the drift — so a visitor
 * whose environment answers nothing at all still sees the scene breathe.
 */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    setFine(window.matchMedia('(pointer: fine)').matches)
  }, [])
  return fine
}
