'use client'
import { useEffect, useRef } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'
import { PALETTE } from '../palette'
import type { ArrivalJourney } from '../use-arrival-journey'
import { gradeAt } from './grade-mood'
import { endingStateAt } from '../ending-timeline'
import { gradeHoldFor } from '../scene/desk-studio'

export { SHOW_GRADE } from './grade-mood'

/**
 * Task 55 — the document half of the CINEMATIC BIOME GRADE: what a lens adds on top of the
 * frame. The mood itself is carried by the scene (scene/biome-atmosphere.tsx repaints the sky and
 * tints the light); this layer only closes the frame with a per-biome edge vignette and a whisper
 * of haze in the mood's colour, so the effect covers the whole document and not just the canvas.
 *
 * DELIBERATELY SLIGHT. The first cut put the whole grade here, as one tinted sheet over the
 * frame. It read as fog: the corner mascots lost their colours and the planet had to be masked
 * out of it, which left a bright halo around the little world. Colour that arrives as light does
 * not have that problem, so everything except the vignette moved into the scene and what is left
 * here is capped by HAZE_ALPHA_MAX.
 *
 * WHY THE CARDS ARE SAFE. This mounts FIRST inside the overlay, so the panels and the progress
 * rail paint above it. Card legibility is a property of paint order, not of gentle numbers.
 *
 * CHEAP BY CONSTRUCTION, like the progress rail: the grade is a pure function of its inputs, so it
 * is written straight to the DOM as three custom properties — zero React renders across the whole
 * journey, and no CSS transition anywhere (scrubbing back retraces the same values instead of
 * chasing a stale animation).
 *
 * TWO TRIGGERS, and both are still needed after Task 59 removed the grade's reveal input. Scroll
 * events cover scrubbing. Driver frames cover the rest: `progressRef` IS the arrival driver's own
 * progress (small-world-experience wires them together), and the driver moves it with no scroll
 * events at all while it absorbs and then releases the scroll a checkpoint swallows. A scroll-only
 * listener would therefore read a stale progress across every arrival. `journey.subscribe` fires
 * once per driver frame and the driver idles whenever the journey is simply on the finger, so a
 * still page still costs nothing.
 *
 * COMPOSITING. Two plain-alpha quads, no `filter` and no blend mode — free by construction, and
 * measured at a locked 60fps at both 1x and 2x device pixel ratio. A `filter` on the element
 * containing the WebGL canvas (the other shape this could have taken) makes the compositor read
 * the canvas back and re-filter it every frame; it also held 60fps on the machine this was
 * measured on, so it was rejected on looks rather than on cost — see task-55-report.md.
 *
 * Reduced motion never reaches this code: SmallWorldExperience renders the static fallback
 * timeline instead of the canvas, so there is no grade to switch instantly.
 */

const LAYER: CSSProperties = { position: 'absolute', inset: 0 }

const HAZE_LAYER: CSSProperties = {
  ...LAYER,
  background: 'var(--sw-grade-haze)',
  opacity: 'var(--sw-grade-haze-a)',
}

const VIGNETTE_LAYER: CSSProperties = {
  ...LAYER,
  background: `radial-gradient(ellipse 96% 96% at 50% 50%, transparent 38%, ${PALETTE.ink} 100%)`,
  opacity: 'var(--sw-grade-vig-a)',
}

export function BiomeGrade({
  progressRef,
  journey,
}: {
  progressRef: MutableRefObject<number>
  /** Supplies the driver's per-frame tick; absent → the grade recomputes on scroll events alone. */
  journey?: ArrivalJourney
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const apply = () => {
      const el = rootRef.current
      if (!el) return
      const progress = progressRef.current
      const g = gradeAt(progress)
      // THE GRADE LETS GO OF THE FRAME AS THE STUDIO ARRIVES (Task 68).
      //
      // This lens is a JOURNEY device — a per-biome vignette and a whisper of haze, both keyed to
      // the wedge under the traveller's feet — and `gradeAt` clamps, so through the whole ending it
      // holds winter's. Over the studio that is simply wrong, and measurably so: with it standing,
      // the shipped money shot read 14-16% under the approved render at the frame's EDGES (the pad's
      // near corner, the desk's white sliver, the top of the backdrop) while the centre read over.
      // That signature is the vignette's, not the bake's. So both alphas fall to zero on the same
      // curve the studio lights come up on.
      //
      // ON THE CLOCK, precisely, because a first draft of this comment overclaimed it. The same
      // FUNCTION drives all four consumers, but not the same INPUT: the three scene consumers read
      // `journeyRef.current.ending`, derived from progress that `useDampedJourney` smooths at
      // lambda 4, and this reads raw scroll. During the pull-back the DOM lens therefore releases
      // roughly 1/lambda ~ 0.25s of scroll AHEAD of the scene, converging to exact agreement
      // wherever the scroll rests — so the money shot is unaffected and the transition is a
      // quarter-second out of step.
      //
      // It is left that way deliberately. This is a DOM lens, and every DOM consumer in this lab
      // (the panels, the progress rail, this) reads `progressRef` directly; the damped value lives
      // inside the Canvas. Making this one read a scene-owned ref would make it the only DOM
      // consumer that freezes if the canvas never mounts, which is a worse failure than a quarter
      // second of lead on a fade.
      const held = gradeHoldFor(endingStateAt(progress))
      el.style.setProperty('--sw-grade-haze', g.haze)
      el.style.setProperty('--sw-grade-haze-a', (g.hazeAlpha * held).toFixed(4))
      el.style.setProperty('--sw-grade-vig-a', (g.vignetteAlpha * held).toFixed(4))
    }
    // Deferred to rAF for the same reason the panels defer: this has to read the progress ref
    // AFTER the experience's own scroll listener has written it for this event.
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    const unsubscribe = journey?.subscribe(apply)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      unsubscribe?.()
    }
  }, [progressRef, journey])

  return (
    <div
      ref={rootRef}
      data-testid="sw-biome-grade"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <div style={HAZE_LAYER} />
      <div style={VIGNETTE_LAYER} />
    </div>
  )
}
