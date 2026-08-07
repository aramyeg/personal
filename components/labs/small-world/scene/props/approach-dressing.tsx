'use client'
import { CanyonBadlands } from './canyon-badlands'
import { DeltaShoals } from './delta-shoals'
import { DesertGroves } from './desert-groves'
import { WinterStands } from './winter-stands'
import type { JourneyRef } from '../use-journey'

/**
 * THE UNDERSIDE DRESSING (Task 86) — one mount for the four wedges whose lower ground the
 * T84 audit found undesigned ("lumps in their lower two thirds — the largest object on
 * screen for the whole scroll").
 *
 * WHY THESE FOUR AND NOT "CHAPTERS 2–5". The camera is static and the planet turns under
 * it, so a checkpoint's frame is a fixed map of travel fraction (see approach-kit.tsx for
 * the projection). Measured against a flat-coloured wedge-identity bake at all six
 * checkpoints, the wedge boundary lands at ndc_y ≈ −0.237 — 557 px down a 900 px frame,
 * predicted 557, measured 545–560. Everything BELOW that line at chapter N's checkpoint
 * belongs to wedge N+1. So the undersides the audit is describing are, in order:
 *
 *   chapter 2's underside = the A2 delta's approach      (DeltaShoals)
 *   chapter 3's underside = the B0 desert's approach     (DesertGroves)
 *   chapter 4's underside = the B1 canyon's approach     (CanyonBadlands)
 *   chapter 5's underside = the B2 winter's approach     (WinterStands)
 *
 * which is why the fix for "chapter 3 reads as poultry legs" is three palms in the DESERT
 * and not anything in the delta at all, and why the winter wedge is dressed by a task whose
 * brief names chapters 2–5. Each file also carries its wedge's t ≈ 0.75–1.0 tail, which is
 * the lower-middle band at that wedge's OWN checkpoint.
 *
 * Each wedge keeps its own grammar — braided shoals, dune groves, talus fans, conifer
 * stands — because a single mechanism repeated four times is the monoculture this lab has
 * been burned by before; only the placement machine is shared.
 */
export function ApproachDressing({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      <DeltaShoals journeyRef={journeyRef} />
      <DesertGroves journeyRef={journeyRef} />
      <CanyonBadlands journeyRef={journeyRef} />
      <WinterStands journeyRef={journeyRef} />
    </>
  )
}
