import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import {
  STAND_END,
  ENDING_IDLE,
  ENDING_SPAN,
  TRACK_END,
  ZOOM_FIRST_MOVE,
  ZOOM_START,
  endingStateAt,
  trackOffsetFor,
  trackProgressAt,
} from '@/components/labs/small-world/ending-timeline'
import {
  PANEL_END,
  ROTATION_TOTAL,
  TRAVEL_END,
  journeyStateAt,
  rotationAt,
} from '@/components/labs/small-world/journey-timeline'
import { dwellChapterAt, initialArrival, stepArrival } from '@/components/labs/small-world/arrival'
import { moodBlendAt } from '@/components/labs/small-world/overlay/grade-mood'

const SWEEP = 4000
const endingAt = (u: number) => 1 + u * ENDING_SPAN

describe('the ending segment', () => {
  it('is idle — and the SAME object — for the whole journey, boundary included', () => {
    for (let i = 0; i <= SWEEP; i++) {
      expect(endingStateAt(i / SWEEP)).toBe(ENDING_IDLE)
    }
    expect(endingStateAt(1).active).toBe(false)
    expect(endingStateAt(-0.5)).toBe(ENDING_IDLE)
  })

  it('runs its own t from 0 at the journey end to 1 at the bottom of the track', () => {
    expect(endingStateAt(1 + 1e-9).t).toBeCloseTo(0, 6)
    expect(endingStateAt(endingAt(0.5)).t).toBeCloseTo(0.5, 12)
    expect(endingStateAt(TRACK_END).t).toBe(1)
    // Past the track's own end nothing continues to grow — the domain is closed.
    expect(endingStateAt(TRACK_END + 5).t).toBe(1)
  })

  it('names the phases in order, with the still beat between them', () => {
    expect(endingStateAt(0.5).phase).toBe('journey')
    expect(endingStateAt(endingAt(STAND_END / 2)).phase).toBe('still')
    expect(endingStateAt(endingAt(ZOOM_START - 1e-6)).phase).toBe('still')
    expect(endingStateAt(endingAt(ZOOM_START + 1e-6)).phase).toBe('zoom')
    expect(endingStateAt(TRACK_END).phase).toBe('zoom')
  })

  it('raises the stand first and PARKS it, then pulls back', () => {
    const gathered = endingStateAt(endingAt(STAND_END))
    expect(gathered.stand).toBe(1)
    expect(gathered.zoom).toBe(0)
    // Parked for the rest of the ending: the world stays seated while the camera withdraws.
    expect(endingStateAt(TRACK_END).stand).toBe(1)

    // The HELD part of the still beat: the stand has landed, the zoom has not started.
    expect(STAND_END).toBeLessThan(ZOOM_START)
    const still = endingStateAt(endingAt((STAND_END + ZOOM_START) / 2))
    expect(still.stand).toBe(1)
    expect(still.zoom).toBe(0)

    expect(endingStateAt(TRACK_END).zoom).toBe(1)
  })

  it('is pure: scrubbing backwards retraces the identical values', () => {
    const forward: number[][] = []
    for (let i = 0; i <= SWEEP; i++) {
      const s = endingStateAt((i / SWEEP) * TRACK_END)
      forward.push([s.t, s.stand, s.zoom])
    }
    for (let i = SWEEP; i >= 0; i--) {
      const s = endingStateAt((i / SWEEP) * TRACK_END)
      expect([s.t, s.stand, s.zoom]).toEqual(forward[i])
    }
  })

  it('never steps discontinuously across the whole domain', () => {
    const steps = 20_000
    let prev = endingStateAt(0)
    let maxT = 0
    let maxStand = 0
    let maxZoom = 0
    for (let i = 1; i <= steps; i++) {
      const s = endingStateAt((i / steps) * TRACK_END)
      maxT = Math.max(maxT, Math.abs(s.t - prev.t))
      maxStand = Math.max(maxStand, Math.abs(s.stand - prev.stand))
      maxZoom = Math.max(maxZoom, Math.abs(s.zoom - prev.zoom))
      prev = s
    }
    // Each is linear in progress, so a step of TRACK_END/steps moves them by its own slope
    // and nothing else. Any jump would show here as a value orders of magnitude larger.
    const dp = TRACK_END / steps
    expect(maxT).toBeLessThan((dp / ENDING_SPAN) * 1.001)
    expect(maxStand).toBeLessThan((dp / (ENDING_SPAN * STAND_END)) * 1.001)
    expect(maxZoom).toBeLessThan((dp / (ENDING_SPAN * (1 - ZOOM_START))) * 1.001)
  })
})

describe('the domain extension: everything else is saturated past 1', () => {
  it('freezes rotation for the whole ending, bit-identically to its progress-1 value', () => {
    // Compared against `rotationAt(1)` rather than against ROTATION_TOTAL: the formula
    // accumulates `chapterStartRotation(5) + CHAPTER_SLICE`, which lands one ulp below 4π
    // (12.56637061435917 vs 12.566370614359172). That ulp is pre-existing and harmless — every
    // renewal window has ~0.5 rad of margin — but the value the scene renders with is this one,
    // so it is the value the ending must hold, exactly.
    const parked = rotationAt(1)
    expect(parked).toBeCloseTo(ROTATION_TOTAL, 12)
    // Task 73 rewrote `rotationAt` around a park fraction. The ending holds whatever that function
    // returns at 1, so the reshape had to leave THAT value untouched to the bit — the release leg
    // is written as a lerp to `chapterStartRotation(c) + CHAPTER_SLICE` for exactly this reason,
    // and this literal is the value the ending held before the reshape.
    expect(parked).toBe(12.56637061435917)
    for (let i = 0; i <= SWEEP; i++) {
      const p = 1 + (i / SWEEP) * ENDING_SPAN
      expect(rotationAt(p)).toBe(parked)
    }
  })

  it('holds the journey state — chapter, morph, mood — exactly at its progress-1 value', () => {
    const at1 = journeyStateAt(1)
    const mood1 = moodBlendAt(1)
    for (const p of [1.0001, endingAt(0.3), endingAt(0.7), TRACK_END]) {
      const s = journeyStateAt(p)
      expect(s.progress).toBe(1)
      expect(s.rotation).toBe(at1.rotation)
      expect(s.chapter).toBe(at1.chapter)
      expect(s.morph).toEqual(at1.morph)
      expect(s.panel).toBeNull()
      expect(s.burst).toBeNull()
      // The winter mood holds by construction — no ending mood exists, and none is needed.
      expect(moodBlendAt(p)).toEqual(mood1)
    }
  })

  it('carries the ending on JourneyState, built from the UN-clamped progress', () => {
    expect(journeyStateAt(0.5).ending.active).toBe(false)
    const s = journeyStateAt(endingAt(0.5))
    expect(s.ending.active).toBe(true)
    expect(s.ending.t).toBeCloseTo(0.5, 12)
    // `progress` cannot tell the ending apart from the journey's last frame. `ending` can.
    expect(s.progress).toBe(journeyStateAt(1).progress)
  })
})

describe('the ending is outside every dwell and every absorption', () => {
  it("starts after chapter 6's dwell has already released", () => {
    const lastDwellEnd = (CHAPTER_COUNT - 1 + PANEL_END) / CHAPTER_COUNT
    expect(lastDwellEnd).toBeLessThan(1)
    expect(dwellChapterAt(lastDwellEnd)).toBeNull()
    for (let i = 0; i <= SWEEP; i++) {
      expect(dwellChapterAt(1 + (i / SWEEP) * ENDING_SPAN)).toBeNull()
    }
  })

  it('never absorbs: the arrival driver stays in pass mode across the whole ending', () => {
    // Drive the real state machine at a realistic scroll speed from just before the ending
    // through the bottom of the track. A hold could only arm off a reveal, and there is none.
    let state = initialArrival(0.99)
    const dt = 1 / 60
    for (let i = 1; i <= 600; i++) {
      const raw = Math.min(TRACK_END, 0.99 + i * 0.002)
      state = stepArrival(state, raw, dt)
      expect(state.reveal).toBeNull()
      if (raw > 1) {
        expect(state.mode).toBe('pass')
        expect(state.progress).toBe(raw)
      }
    }
    expect(state.progress).toBeCloseTo(TRACK_END, 12)
  })
})

describe('the scroll track mapping', () => {
  const total = 17_600

  it('puts the journey in [0, 1] and the ending in the rest of the track', () => {
    expect(trackProgressAt(0, total)).toBe(0)
    expect(trackProgressAt(total, total)).toBeCloseTo(TRACK_END, 12)
    expect(trackProgressAt(total / TRACK_END, total)).toBeCloseTo(1, 12)
  })

  it('clamps to the domain and survives a track with no scroll at all', () => {
    expect(trackProgressAt(-500, total)).toBe(0)
    expect(trackProgressAt(total * 2, total)).toBe(TRACK_END)
    expect(trackProgressAt(500, 0)).toBe(0)
    expect(trackProgressAt(500, -10)).toBe(0)
  })

  it('round-trips tap-to-advance: an offset for a chapter boundary lands on that boundary', () => {
    for (let c = 1; c <= CHAPTER_COUNT; c++) {
      const p = c / CHAPTER_COUNT
      expect(trackProgressAt(trackOffsetFor(p, total), total)).toBeCloseTo(p, 12)
    }
    // The bug this guards: dividing by 1 instead of TRACK_END overshoots every chapter.
    expect(trackOffsetFor(1 / CHAPTER_COUNT, total)).toBeLessThan(total / CHAPTER_COUNT)
  })
})

describe('the invariant boundary', () => {
  it('separates the last progress rotation can move at from the first the camera can', () => {
    // Derived from the timeline, not restated: the camera's first possible move sits a whole
    // still beat after the last progress at which rotation is still a function of scroll.
    expect(ZOOM_FIRST_MOVE).toBe(1 + ZOOM_START * ENDING_SPAN)
    expect(ZOOM_FIRST_MOVE).toBeGreaterThan(1)
    expect(endingStateAt(ZOOM_FIRST_MOVE).zoom).toBe(0)

    // TASK 73 SHORTENED THIS BEAT, DELIBERATELY AND WITH SIGN-OFF, and the change is worth stating
    // precisely because the invariant it sits inside is unchanged.
    //
    // Rotation used to be frozen from the chapter-6 stop at 0.925, because the stop was at the END
    // of the last slice — which was also why every card was up over the wrong biome. The stop is
    // now at PARK_FRAC of the slice (0.873 at Task 75's park, 0.855 at Task 73's) and the release
    // leg carries the remaining 0.60 of a slice, so the world keeps turning until progress 1.0 and
    // the visitor walks out across the epilogue face before the ending begins. The still beat is therefore ZOOM_FIRST_MOVE - 1
    // (0.063) rather than ZOOM_FIRST_MOVE - 0.925 (0.138): less than half of what it was, and
    // still a whole beat in which nothing moves at all.
    //
    // What has NOT changed is the disjointness that makes the ending safe: rotation is a function
    // of scroll only BELOW 1, the camera cannot move below ZOOM_FIRST_MOVE > 1, and the two sets
    // do not touch.
    const lastMovingRotation = 1
    expect(rotationAt(lastMovingRotation)).toBe(rotationAt(1))
    expect(lastMovingRotation).toBeLessThan(ZOOM_FIRST_MOVE)
    expect(rotationAt(1 - 1e-9)).toBeLessThan(rotationAt(1))
  })
})
