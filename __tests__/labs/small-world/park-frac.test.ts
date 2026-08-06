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
    expect(TRAVEL_END).toBeCloseTo(0.24, 12)
    expect(BURST_END).toBeCloseTo(0.34, 12)
    expect(PANEL_END).toBeCloseTo(0.64, 12)
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
    // The beat: card 6 releases before the journey ends and rotation keeps turning to 1.0, so she
    // walks out across the epilogue face rather than cutting straight to the ending. Task 75's
    // later park shortens it — 0.940 to 1.0, i.e. 0.060 of the track against Task 73's 0.078 —
    // which is the shorter walk-out Aram asked for, and it is still a walk and not a cut.
    const lastCard = (CHAPTER_COUNT - 1 + PANEL_END) / CHAPTER_COUNT
    expect(lastCard).toBeCloseTo(0.94, 12)
    expect(1 - lastCard).toBeGreaterThan(0.05)
    expect(rotationAt(lastCard)).toBeLessThan(rotationAt(1))
  })
})

/**
 * TASK 75 — HOW LATE THE PARK MAY BE, as arithmetic.
 *
 * Task 73 proved the stop had to move to the FRONT of a chapter's slice. Aram's verdict on what
 * shipped was that 0.21 displaced the scroll: a 13% walk-in and a 47% walk-out is not the rhythm.
 * So the park is taken as late as the framing allows, and "clearly dominant" is written down.
 *
 * The rows below are the projected-area census (the `task60-vista` extension, swept over
 * PARK_FRAC), minimum across the six chapters — chapter 3, the desert, binds every row, and
 * 1440x900 binds 390x844 by about 0.4 pt, so these are the desktop numbers. They are a FIXTURE:
 * a future retune of the park cannot re-measure them from a unit test, but it can and must
 * confront the two thresholds they imply.
 */
describe('the park is as late as the framing allows', () => {
  const CENSUS: readonly (readonly [park: number, own: number, next: number])[] = [
    [0.21, 78.07, 15.89],
    [0.3, 72.95, 21.61],
    [0.34, 70.2, 24.86],
    [0.38, 67.13, 28.55],
    [0.395, 65.76, 30.24],
    [0.4, 65.29, 30.8],
    [0.405, 64.83, 31.35],
    [0.41, 64.36, 31.9],
    [0.415, 63.9, 32.44],
    [0.42, 63.43, 32.98],
    [0.5, 55.83, 41.96],
  ]

  /** Linear interpolation of the measured curve at the shipped park — both rows bracket it. */
  const measuredAt = (park: number, pick: (row: (typeof CENSUS)[number]) => number): number => {
    const hi = CENSUS.findIndex((r) => r[0] >= park)
    if (hi <= 0) return pick(CENSUS[Math.max(0, hi)])
    const [a, b] = [CENSUS[hi - 1], CENSUS[hi]]
    const u = (park - a[0]) / (b[0] - a[0])
    return pick(a) + (pick(b) - pick(a)) * u
  }

  it('keeps the chapter’s own biome across at least 65% of the frame', () => {
    expect(measuredAt(PARK_FRAC, (r) => r[1])).toBeGreaterThanOrEqual(65)
  })

  it('keeps it at least twice whatever the next biome holds', () => {
    expect(measuredAt(PARK_FRAC, (r) => r[1]) / measuredAt(PARK_FRAC, (r) => r[2])).toBeGreaterThanOrEqual(2)
  })

  it('is nonetheless LATE — the rhythm Task 73 spent is bought back', () => {
    // Both halves of Aram's verdict, as one assertion each: the walk-in is no longer a token one,
    // and the walk-out is no longer most of the chapter.
    expect(PARK_FRAC).toBeGreaterThan(0.21 * 1.5)
    expect(1 - PANEL_END).toBeLessThan(0.4)
  })

  it('leaves the census monotone, so the thresholds bracket a single crossing', () => {
    for (let i = 1; i < CENSUS.length; i++) {
      expect(CENSUS[i][1]).toBeLessThan(CENSUS[i - 1][1])
      expect(CENSUS[i][2]).toBeGreaterThan(CENSUS[i - 1][2])
    }
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
