import { describe, expect, it } from 'vitest'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import {
  CURTAIN_END,
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
    expect(endingStateAt(endingAt(CURTAIN_END / 2)).phase).toBe('curtain')
    expect(endingStateAt(endingAt(ZOOM_START - 1e-6)).phase).toBe('curtain')
    expect(endingStateAt(endingAt(ZOOM_START + 1e-6)).phase).toBe('zoom')
    expect(endingStateAt(TRACK_END).phase).toBe('zoom')
  })

  it('gathers the curtain first and PARKS it, then pulls back', () => {
    const gathered = endingStateAt(endingAt(CURTAIN_END))
    expect(gathered.curtain).toBe(1)
    expect(gathered.zoom).toBe(0)
    // Parked for the rest of the ending: the bow does not pack up when the camera moves.
    expect(endingStateAt(TRACK_END).curtain).toBe(1)

    // The still beat: curtain finished, zoom not started.
    expect(CURTAIN_END).toBeLessThan(ZOOM_START)
    const still = endingStateAt(endingAt((CURTAIN_END + ZOOM_START) / 2))
    expect(still.curtain).toBe(1)
    expect(still.zoom).toBe(0)

    expect(endingStateAt(TRACK_END).zoom).toBe(1)
  })

  it('is pure: scrubbing backwards retraces the identical values', () => {
    const forward: number[][] = []
    for (let i = 0; i <= SWEEP; i++) {
      const s = endingStateAt((i / SWEEP) * TRACK_END)
      forward.push([s.t, s.curtain, s.zoom])
    }
    for (let i = SWEEP; i >= 0; i--) {
      const s = endingStateAt((i / SWEEP) * TRACK_END)
      expect([s.t, s.curtain, s.zoom]).toEqual(forward[i])
    }
  })

  it('never steps discontinuously across the whole domain', () => {
    const steps = 20_000
    let prev = endingStateAt(0)
    let maxT = 0
    let maxCurtain = 0
    let maxZoom = 0
    for (let i = 1; i <= steps; i++) {
      const s = endingStateAt((i / steps) * TRACK_END)
      maxT = Math.max(maxT, Math.abs(s.t - prev.t))
      maxCurtain = Math.max(maxCurtain, Math.abs(s.curtain - prev.curtain))
      maxZoom = Math.max(maxZoom, Math.abs(s.zoom - prev.zoom))
      prev = s
    }
    // Each is linear in progress, so a step of TRACK_END/steps moves them by its own slope
    // and nothing else. Any jump would show here as a value orders of magnitude larger.
    const dp = TRACK_END / steps
    expect(maxT).toBeLessThan((dp / ENDING_SPAN) * 1.001)
    expect(maxCurtain).toBeLessThan((dp / (ENDING_SPAN * CURTAIN_END)) * 1.001)
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
    // curtain call after the last progress at which rotation is still a function of scroll.
    expect(ZOOM_FIRST_MOVE).toBe(1 + ZOOM_START * ENDING_SPAN)
    expect(ZOOM_FIRST_MOVE).toBeGreaterThan(1)
    expect(endingStateAt(ZOOM_FIRST_MOVE).zoom).toBe(0)
    // ...and rotation is in fact frozen well before 1: the chapter-6 stop, at 0.925.
    const lastMovingRotation = (CHAPTER_COUNT - 1 + TRAVEL_END) / CHAPTER_COUNT
    expect(rotationAt(lastMovingRotation)).toBe(rotationAt(1))
    expect(lastMovingRotation).toBeLessThan(ZOOM_FIRST_MOVE)
  })
})
