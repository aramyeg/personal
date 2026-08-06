import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import {
  PANEL_END,
  ROTATION_TOTAL,
  chapterParkRotation,
  rotationAt,
} from '@/components/labs/small-world/journey-timeline'
import {
  EPILOGUE_START,
  FLIP_START,
  FLIP_WIDTH,
  epilogueGate,
  renewalGate,
} from '@/components/labs/small-world/scene/renewal'

/**
 * THE WALK-OUT BEAT CANNOT SHOW A HALF-FINISHED FLIP.
 *
 * Task 73 moved the last checkpoint from the end of chapter 6's rotation slice to `PARK_FRAC` of
 * it, which means the visitor now WATCHES the world turn through the last 0.79 of a slice — from
 * rotation 10.912 to 4pi — instead of arriving with it already parked there. That stretch is
 * exactly where the epilogue flip happens (band 0's desert repainting as snow one turn later), so
 * it is the one thing the new beat could plausibly expose that the old timeline hid by never
 * showing it moving.
 *
 * THE PROOF IS ROTATION-INVARIANT, and that is the whole answer. Both renewal gates are functions
 * of `q = rotation − thetaC` alone, and occlusion is too — the hidden band `renewal-scan.mjs`
 * measured, q in (0.9425, 2.9060), repeats at every q + 2*pi*k. So "is the flip hidden" was never a
 * question about the timeline; it is a question about q, and the reshape does not introduce a
 * single q that was not already reachable (rotation is still monotone across the same 0 → 4pi).
 *
 * That makes this file a GUARD rather than a re-derivation: it pins the arithmetic at the rotations
 * the new beat actually visits, so that a future reshape which DID change the range — or which let
 * rotation run past 4pi — could not quietly walk the visitor into a visible lerp.
 */

/** The occlusion band `renewal-scan.mjs` proves, against the finite camera at realistic relief. */
const HIDDEN_Q_FROM = 0.9425
const HIDDEN_Q_TO = 2.906
const TWO_PI = Math.PI * 2

/** A vertex is on camera only OUTSIDE the hidden band, modulo a full turn. */
const visible = (q: number): boolean => {
  const m = ((q % TWO_PI) + TWO_PI) % TWO_PI
  return m <= HIDDEN_Q_FROM || m >= HIDDEN_Q_TO
}

/** Mid-flip: strictly between the two crisp states, i.e. a lerp the eye could catch. */
const midFlip = (g: number): boolean => g > 0 && g < 1

describe('the walk-out beat never shows a renewal mid-flip', () => {
  const WALK_FROM = chapterParkRotation(CHAPTER_COUNT - 1)
  const WALK_TO = rotationAt(1)

  it('covers the stretch the new beat actually added', () => {
    // Card 6 releases here and the world keeps turning to 4pi — 0.79 of a slice the visitor used
    // not to watch. If this ever shrinks to nothing the rest of the file is vacuous.
    expect(WALK_TO - WALK_FROM).toBeGreaterThan(1.6)
    expect(rotationAt((CHAPTER_COUNT - 1 + PANEL_END) / CHAPTER_COUNT)).toBeCloseTo(WALK_FROM, 12)
    expect(WALK_TO).toBeCloseTo(ROTATION_TOTAL, 12)
  })

  it('keeps every mid-flip vertex behind the horizon for the whole walk out', () => {
    for (let i = 0; i <= 600; i++) {
      const rotation = WALK_FROM + ((WALK_TO - WALK_FROM) * i) / 600
      for (let j = 0; j < 720; j++) {
        const thetaC = (j / 720) * TWO_PI
        const q = rotation - thetaC
        if (midFlip(renewalGate(thetaC, rotation)) || midFlip(epilogueGate(thetaC, rotation))) {
          expect(visible(q), `rotation ${rotation.toFixed(4)} thetaC ${thetaC.toFixed(4)}`).toBe(false)
        }
      }
    }
  })

  it('states the same thing as arithmetic, so it holds at every rotation and not just the sampled ones', () => {
    // A gate is mid-flip only inside its own window in q; the windows must sit strictly inside the
    // hidden band, modulo a turn. This is the claim the sweep above spot-checks.
    for (const start of [FLIP_START, EPILOGUE_START]) {
      const from = ((start % TWO_PI) + TWO_PI) % TWO_PI
      expect(from, 'flip opens inside the hidden band').toBeGreaterThan(HIDDEN_Q_FROM)
      expect(from + FLIP_WIDTH, 'and closes before the band ends').toBeLessThan(HIDDEN_Q_TO)
    }
  })

  it('has the last card itself parked on crisp paint, everywhere', () => {
    // The dwell the reader spends longest in, pinned directly rather than inferred from the sweep.
    for (let j = 0; j < 2000; j++) {
      const thetaC = (j / 2000) * TWO_PI
      const g = renewalGate(thetaC, WALK_FROM)
      const e = epilogueGate(thetaC, WALK_FROM)
      if (visible(WALK_FROM - thetaC)) {
        expect(midFlip(g), `renewal lerp on camera at thetaC ${thetaC.toFixed(4)}`).toBe(false)
        expect(midFlip(e), `epilogue lerp on camera at thetaC ${thetaC.toFixed(4)}`).toBe(false)
      }
    }
  })
})
