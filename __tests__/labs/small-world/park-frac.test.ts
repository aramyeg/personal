import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import {
  BURST_END,
  BURST_SPAN,
  CHAPTER_SLICE,
  DWELL_MID,
  DWELL_SPAN,
  PANEL_END,
  PARK_FRAC,
  ROTATION_TOTAL,
  TRAVEL_END,
  approachFrac,
  chapterDwellProgress,
  chapterParkRotation,
  chapterStartRotation,
  chapterTravelProgress,
  journeyStateAt,
  rotationAt,
} from '@/components/labs/small-world/journey-timeline'
import { ZOOM_FIRST_MOVE } from '@/components/labs/small-world/ending-timeline'
import {
  BERG_REVEAL_SPAN_FRAC,
  BERG_REVEAL_START_FRAC,
} from '@/components/labs/small-world/scene/props/berg-reveal'

/**
 * TASK 73 — THE FRAMING FIX, as arithmetic.
 *
 * The defect: `CHAPTER_SLICE === BAND_SPAN`, and rotation used to spend the whole slice before
 * freezing, so every card was read while the girl stood on the FAR MERIDIAN of the biome it was
 * about — its own scenery behind her at 8.5–12.6% of the frame, the next chapter's filling it.
 *
 * These are the properties the fix has to keep, stated where a future reshape will trip over them.
 */
describe('the park', () => {
  it('stops her INSIDE her own slice, not at the end of it', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const park = chapterParkRotation(c)
      expect(park).toBeGreaterThan(chapterStartRotation(c))
      expect(park).toBeLessThan(chapterStartRotation(c + 1))
      // ...and near the FRONT of it, which is what puts the slice's scenery across the frame.
      expect((park - chapterStartRotation(c)) / CHAPTER_SLICE).toBeCloseTo(PARK_FRAC, 12)
    }
  })

  it('parks the rotation there for the whole of the dwell and not a float either side', () => {
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const park = chapterParkRotation(c)
      for (let k = 0; k <= 20; k++) {
        const local = TRAVEL_END + ((PANEL_END - TRAVEL_END) * k) / 20
        expect(rotationAt((c + local) / CHAPTER_COUNT), `ch${c} step ${k}`).toBeCloseTo(park, 12)
      }
      // moving on both sides of it
      expect(rotationAt((c + TRAVEL_END * 0.5) / CHAPTER_COUNT)).toBeLessThan(park)
      if (c < CHAPTER_COUNT - 1) {
        expect(rotationAt((c + 0.9) / CHAPTER_COUNT)).toBeGreaterThan(park)
      }
    }
  })
})

describe('the segment shape is solved, not typed in', () => {
  it('turns the world at ONE rate, approach and release alike', () => {
    // The requirement the three window constants are the unique solution to. A visitor scrolling
    // at a steady speed must not feel the planet change gear across a dwell.
    expect(PARK_FRAC / TRAVEL_END).toBeCloseTo((1 - PARK_FRAC) / (1 - PANEL_END), 12)
  })

  it('preserves the burst and the dwell exactly — the choreography is not the fix’s to spend', () => {
    expect(BURST_END - TRAVEL_END).toBeCloseTo(BURST_SPAN, 12)
    expect(PANEL_END - BURST_END).toBeCloseTo(DWELL_SPAN, 12)
    expect(DWELL_SPAN).toBe(0.3)
    // ...and the arrival clock's own dwell (TRAVEL_END → PANEL_END) is preserved too, at 0.40.
    expect(PANEL_END - TRAVEL_END).toBeCloseTo(0.4, 12)
  })

  it('derives the windows from PARK_FRAC rather than restating them', () => {
    expect(TRAVEL_END).toBeCloseTo(PARK_FRAC * (1 - BURST_SPAN - DWELL_SPAN), 12)
    expect(TRAVEL_END).toBeCloseTo(0.126, 12)
    expect(BURST_END).toBeCloseTo(0.226, 12)
    expect(PANEL_END).toBeCloseTo(0.526, 12)
  })

  it('names the dwell so probes and e2e stop hard-coding fractions of it', () => {
    expect(DWELL_MID).toBeGreaterThan(BURST_END)
    expect(DWELL_MID).toBeLessThan(PANEL_END)
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      expect(journeyStateAt(chapterDwellProgress(c)).panel?.chapter, `ch${c} card up`).toBe(c)
      expect(journeyStateAt(chapterTravelProgress(c)).panel, `ch${c} travelling`).toBeNull()
    }
  })
})

describe('the ending is untouched by the reshape', () => {
  it('lands rotation on ROTATION_TOTAL at progress 1, to the bit', () => {
    // The ending holds `rotationAt(1)` frozen for its whole length and compares with `toBe`, so
    // this is an identity requirement and not a tolerance one.
    expect(rotationAt(1)).toBe(chapterStartRotation(CHAPTER_COUNT - 1) + CHAPTER_SLICE)
    expect(rotationAt(1)).toBe(12.56637061435917) // the value it held before the reshape
    expect(rotationAt(1)).toBeCloseTo(ROTATION_TOTAL, 12)
  })

  it('still leaves a whole beat in which nothing moves, though a shorter one', () => {
    // Rotation moves only below 1; the camera only above ZOOM_FIRST_MOVE. Disjoint, as before —
    // the beat between them is now 0.063 of progress rather than 0.138, which is the sanctioned
    // cost of letting her walk out across the epilogue face.
    expect(ZOOM_FIRST_MOVE).toBeGreaterThan(1)
    expect(rotationAt(1)).toBe(rotationAt(ZOOM_FIRST_MOVE))
    expect(ZOOM_FIRST_MOVE - 1).toBeGreaterThan(0.05)
  })

  it('adds the walk-out beat before the ending, and it is real scroll', () => {
    // The new beat: card 6 releases at 0.855+ and rotation keeps turning to 1.0.
    const lastCard = (CHAPTER_COUNT - 1 + PANEL_END) / CHAPTER_COUNT
    expect(lastCard).toBeLessThan(1)
    expect(1 - lastCard).toBeGreaterThan(0.07)
    expect(rotationAt(lastCard)).toBeLessThan(rotationAt(1))
  })
})

describe('props that must be standing before the card', () => {
  it('gives approach windows in approach units, so they cannot outlive the walk-in', () => {
    expect(approachFrac(1)).toBe(PARK_FRAC)
    expect(approachFrac(0.85)).toBeLessThan(PARK_FRAC)
  })

  it('finishes the icebergs before the winter card opens', () => {
    // They grow ON CAMERA on the always-visible limb, so "before the card" is the whole point.
    expect(BERG_REVEAL_START_FRAC + BERG_REVEAL_SPAN_FRAC).toBeLessThan(PARK_FRAC)
  })

  it('finishes the desert caravan before the desert card opens', () => {
    // set-accenture's window, in the same units it declares them.
    expect(approachFrac(0.45) + approachFrac(0.4)).toBeLessThan(PARK_FRAC)
  })
})
