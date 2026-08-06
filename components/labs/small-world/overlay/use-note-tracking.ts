'use client'
import { useEffect, useRef } from 'react'
import { noteParallaxShift } from '../scene/note-parallax-shift'

/**
 * KEEPS THE CONNECT BLOCK ON THE NOTE WHILE THE CAMERA BREATHES (Task 72, second addendum).
 *
 * `note-parallax-shift.ts` owns what the number means and why no amount of clearance could have
 * done this instead; this owns only how it reaches the element.
 *
 * ============================================================================
 * WHY A RAF AND NOT A RE-RENDER
 * ============================================================================
 * The shift changes every frame of a pointer move. Routing it through React state would re-render
 * the block sixty times a second — the block that holds four real anchors, the focus machinery and
 * the reveal arithmetic — to move it a few pixels. So it is written straight to `style.transform`,
 * which the compositor can take without laying anything out again.
 *
 * The loop only exists while the block is mounted, and the block is mounted only for the ending
 * segment (`journey-overlay.tsx` renders the slot off `ui.ending`). During the entire journey there
 * is no loop, no read and no write.
 *
 * ============================================================================
 * WHAT IT MAY AND MAY NOT MOVE
 * ============================================================================
 * ONLY a transform, and only on the block's own container. The block's resting layout — the
 * `bottom` inset, the gap, and the derived narrow-viewport lift — is untouched: this rides ON TOP of
 * whatever `connect-clearance.ts` solved, so at zero pointer input the transform is exactly
 * `translate3d(0px, 0px, 0)` and the composition is the approved one to the pixel.
 *
 * A reduced-motion visitor, a touch visitor whose drift is disabled, and anyone who has not moved a
 * pointer all get a hard zero from the rig, so the string written here is the identity transform and
 * the element never leaves the layout position the CSS gave it.
 *
 * `translate3d` rather than `translate` so the block gets its own compositor layer instead of
 * repainting the text every frame — this element carries a hand-drawn font and four bordered pills.
 */

/** ndc → CSS pixels, and the y flip: ndc y climbs the screen, CSS y descends it. */
const round = (v: number): number => Math.round(v * 100) / 100

export function useNoteTracking() {
  const ref = useRef<HTMLDivElement | null>(null)
  // what was last written, so a frame that changed nothing costs one compare and no DOM touch
  const last = useRef('')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const dx = round((noteParallaxShift.x * window.innerWidth) / 2)
      const dy = round((-noteParallaxShift.y * window.innerHeight) / 2)
      const next = `translate3d(${dx}px, ${dy}px, 0)`
      if (next === last.current) return
      last.current = next
      el.style.transform = next
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      // leave the element exactly as the CSS would have it, not wherever the pointer last was
      el.style.transform = ''
      last.current = ''
    }
  }, [])

  return ref
}
